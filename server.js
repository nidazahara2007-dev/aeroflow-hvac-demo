import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(root,'public');
const dataDir=path.join(root,'data');
const dataFile=path.join(dataDir,'store.json');
fs.mkdirSync(dataDir,{recursive:true});
const defaults={settings:{company:'AEROFLOW',tagline:'Climate control. Elevated.',phone:'',email:'',location:'Serving your community',announcement:'Premium HVAC experience · Concept demonstration'},services:[{id:'cooling',title:'Air Conditioning',eyebrow:'01 / COOLING',desc:'Precision cooling that feels effortless, all summer long.',icon:'snowflake'},{id:'heating',title:'Heating & Furnaces',eyebrow:'02 / HEATING',desc:'Thoughtful warmth and dependable performance when it matters.',icon:'flame'},{id:'maintenance',title:'Preventive Maintenance',eyebrow:'03 / CARE',desc:'Proactive system care for a more comfortable tomorrow.',icon:'settings'},{id:'air',title:'Indoor Air Quality',eyebrow:'04 / AIR QUALITY',desc:'Breathe easier with cleaner, healthier indoor environments.',icon:'wind'},{id:'commercial',title:'Commercial HVAC',eyebrow:'05 / BUSINESS',desc:'Scalable climate solutions built around your operations.',icon:'building'},{id:'emergency',title:'Emergency Repairs',eyebrow:'06 / SUPPORT',desc:'A clear path to assistance when your comfort is disrupted.',icon:'zap'}],leads:[]};
let db;
try{db=JSON.parse(fs.readFileSync(dataFile,'utf8'));}catch{db=structuredClone(defaults);save();}
function save(){const temp=dataFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(temp,dataFile);}
const password=process.env.ADMIN_PASSWORD||'CHANGE_ME_BEFORE_DEPLOY';
const sessions=new Map(),attempts=new Map();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
function respond(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(obj));}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>30000){reject(new Error('Request too large'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});}
function clean(v,max=200){return String(v??'').trim().slice(0,max).replace(/[<>]/g,'');}
function session(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('aeroflow_session='))?.split('=')[1];const s=token&&sessions.get(token);if(!s)return null;if(s<Date.now()){sessions.delete(token);return null;}return token;}
function secure(req){return req.socket.encrypted||req.headers['x-forwarded-proto']==='https';}
function rate(ip,key,max,windowMs){const id=ip+':'+key,now=Date.now();let x=attempts.get(id)||[];x=x.filter(t=>t>now-windowMs);if(x.length>=max)return false;x.push(now);attempts.set(id,x);return true;}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');const p=url.pathname;const method=req.method;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  try{
    if(p==='/api/public'&&method==='GET')return respond(res,200,{settings:db.settings,services:db.services});
    if(p==='/api/inquiries'&&method==='POST'){
      if(!rate(req.socket.remoteAddress,'lead',8,3600000))return respond(res,429,{error:'Too many requests. Please try later.'});
      const b=await body(req);if(b.website)return respond(res,200,{ok:true});
      const lead={id:crypto.randomUUID(),name:clean(b.name,90),email:clean(b.email,160),phone:clean(b.phone,40),service:clean(b.service,100),message:clean(b.message,1200),date:clean(b.date,30),status:'New',notes:'',createdAt:new Date().toISOString()};
      if(lead.name.length<2||!/^\S+@\S+\.\S+$/.test(lead.email)||!lead.service)return respond(res,400,{error:'Please enter a name, valid email and service.'});
      db.leads.unshift(lead);save();return respond(res,201,{ok:true,id:lead.id});
    }
    if(p==='/api/login'&&method==='POST'){
      if(!rate(req.socket.remoteAddress,'login',8,900000))return respond(res,429,{error:'Too many login attempts.'});
      const b=await body(req);const input=Buffer.from(String(b.password||''));const expected=Buffer.from(password);if(input.length!==expected.length||!crypto.timingSafeEqual(input,expected))return respond(res,401,{error:'Incorrect password'});
      const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);return respond(res,200,{ok:true},{'Set-Cookie':`aeroflow_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure(req)?'; Secure':''}`});
    }
    if(p==='/api/logout'&&method==='POST'){const s=session(req);if(s)sessions.delete(s);return respond(res,200,{ok:true},{'Set-Cookie':'aeroflow_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
    if(p.startsWith('/api/admin')){
      if(!session(req))return respond(res,401,{error:'Please sign in'});
      if(p==='/api/admin/data'&&method==='GET')return respond(res,200,db);
      if(p==='/api/admin/leads'&&method==='PATCH'){const b=await body(req);const lead=db.leads.find(x=>x.id===b.id);if(!lead)return respond(res,404,{error:'Lead not found'});if(b.status!==undefined){if(!['New','Contacted','Quoted','Booked','Completed','Closed'].includes(b.status))return respond(res,400,{error:'Invalid status'});lead.status=b.status;}if(b.notes!==undefined)lead.notes=clean(b.notes,2000);save();return respond(res,200,{ok:true});}
      if(p==='/api/admin/leads'&&method==='DELETE'){const b=await body(req);db.leads=db.leads.filter(x=>x.id!==b.id);save();return respond(res,200,{ok:true});}
      if(p==='/api/admin/settings'&&method==='PUT'){const b=await body(req);for(const k of Object.keys(defaults.settings)){if(b[k]!==undefined)db.settings[k]=clean(b[k],200);}save();return respond(res,200,{ok:true});}
      if(p==='/api/admin/services'&&method==='PUT'){const b=await body(req);if(!Array.isArray(b.services)||b.services.length>12)return respond(res,400,{error:'Invalid services'});db.services=b.services.map((s,i)=>({id:clean(s.id||String(i),40),title:clean(s.title,90),eyebrow:clean(s.eyebrow,60),desc:clean(s.desc,250),icon:clean(s.icon,30)}));save();return respond(res,200,{ok:true});}
      if(p==='/api/admin/export'&&method==='GET'){
        const cols=['id','createdAt','name','email','phone','service','date','status','message','notes'];const csv=[cols.join(','),...db.leads.map(l=>cols.map(k=>'"'+String(l[k]||'').replace(/^[=+@\-]/,'\t$&').replace(/"/g,'""')+'"').join(','))].join('\r\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="aeroflow-leads.csv"'});return res.end('\ufeff'+csv);
      }
      return respond(res,404,{error:'Not found'});
    }
    if(p.startsWith('/api/'))return respond(res,404,{error:'Not found'});
    if(method!=='GET'&&method!=='HEAD')return respond(res,405,{error:'Method not allowed'});
    const target=path.resolve(publicDir,'.'+(p==='/'?'/index.html':p));if(!target.startsWith(publicDir+path.sep))return respond(res,403,{error:'Forbidden'});
    fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(method==='HEAD'?'':data);});
  }catch(e){if(!res.headersSent)respond(res,400,{error:e.message||'Request failed'});}
});
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`AeroFlow ready at http://localhost:${port} | Admin: /admin.html${password==='CHANGE_ME_BEFORE_DEPLOY'?' | WARNING: set ADMIN_PASSWORD before deployment':''}`));
