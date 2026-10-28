const DEFAULT_SERVICES = [
{id:"cooling",title:"Air Conditioning",eyebrow:"01 / COOLING",desc:"Precision cooling that feels effortless, all summer long.",icon:"snowflake"},
{id:"heating",title:"Heating & Furnaces",eyebrow:"02 / HEATING",desc:"Thoughtful warmth and dependable performance when it matters.",icon:"flame"},
{id:"maintenance",title:"Preventive Maintenance",eyebrow:"03 / CARE",desc:"Proactive system care for a more comfortable tomorrow.",icon:"settings"},
{id:"air",title:"Indoor Air Quality",eyebrow:"04 / AIR QUALITY",desc:"Breathe easier with cleaner, healthier indoor environments.",icon:"wind"},
{id:"commercial",title:"Commercial HVAC",eyebrow:"05 / BUSINESS",desc:"Scalable climate solutions built around your operations.",icon:"building"},
{id:"emergency",title:"Emergency Repairs",eyebrow:"06 / SUPPORT",desc:"A clear path to assistance when your comfort is disrupted.",icon:"zap"}];
const DEFAULT_SETTINGS = {company:"AEROFLOW",tagline:"Climate control. Elevated.",phone:"",email:"",location:"Serving your community",announcement:"Premium HVAC experience · Concept demonstration"};
const STATUS = ["New","Contacted","Quoted","Booked","Completed","Closed"];
const encoder = new TextEncoder();
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const clean=(v,n=200)=>String(v??"").trim().slice(0,n).replace(/[<>]/g,"");
function b64(bytes){let s="";for(const x of bytes)s+=String.fromCharCode(x);return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
function unb64(s){const bin=atob(s.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(bin,c=>c.charCodeAt(0))}
async function sign(key,text){const k=await crypto.subtle.importKey("raw",encoder.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(new Uint8Array(await crypto.subtle.sign("HMAC",k,encoder.encode(text))))}
async function authorized(req,env){if(!env.SESSION_SECRET)return false;const cookie=req.headers.get("cookie")||"";const token=cookie.match(/(?:^|;\s*)aeroflow_session=([^;]+)/)?.[1];if(!token)return false;const [exp,sig]=token.split(".");if(!exp||!sig||!(/^\d+$/.test(exp))||Number(exp)<Date.now())return false;return (await sign(env.SESSION_SECRET,exp))===sig}
function sameOrigin(req){const origin=req.headers.get("origin");return !origin||origin===new URL(req.url).origin}
async function payload(req){const size=Number(req.headers.get("content-length")||0);if(size>16000)throw Error("Request too large");const raw=await req.text();if(raw.length>16000)throw Error("Request too large");return JSON.parse(raw||"{}")}
async function settings(env){const rows=await env.DB.prepare("SELECT key,value FROM site_settings").all();const result={...DEFAULT_SETTINGS};for(const r of rows.results)if(r.key in result)result[r.key]=r.value;return result}
async function services(env){const rows=await env.DB.prepare("SELECT id,name,description,enabled FROM services").all();if(!rows.results.length)return DEFAULT_SERVICES;return rows.results.filter(r=>r.enabled).map(r=>{const def=DEFAULT_SERVICES.find(x=>x.id===r.id);return {id:r.id,title:r.name,desc:r.description||"",eyebrow:def?.eyebrow||"HVAC SERVICE",icon:def?.icon||"settings"}})}
async function adminData(env){const rows=await env.DB.prepare("SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500").all();return {leads:rows.results.map(r=>({id:r.id,name:r.name,email:r.email,phone:r.phone,service:r.service,date:r.preferred_date,message:r.message,status:r.status,notes:r.admin_notes,createdAt:r.created_at})),settings:await settings(env),services:await services(env)}}
async function api(req,env,path){
 const method=req.method;
 if(method!=="GET"&&!sameOrigin(req))return json({error:"Invalid request origin"},403);
 if(path==="/api/public"&&method==="GET")return json({settings:await settings(env),services:await services(env)});
 if(path==="/api/inquiries"&&method==="POST"){
  const b=await payload(req);if(b.website)return json({ok:true});
  const name=clean(b.name,90),email=clean(b.email,160),phone=clean(b.phone,40),service=clean(b.service,100),message=clean(b.message,1200),date=clean(b.date,30);
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!service)return json({error:"Please enter a name, valid email and service."},400);
  const allowed=await services(env);if(!allowed.some(s=>s.title===service||s.id===service))return json({error:"Please select a valid service."},400);
  await env.DB.prepare("INSERT INTO inquiries (id,name,email,phone,service,preferred_date,message,status,admin_notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),name,email,phone,service,date,message,"New","",new Date().toISOString()).run();
  return json({ok:true},201);
 }
 if(path==="/api/login"&&method==="POST"){
  if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({error:"Admin login is not configured."},503);
  const ip=req.headers.get("CF-Connecting-IP")||"unknown";const key="login:"+ip;
  const attempts=await env.DB.prepare("SELECT count,reset_at FROM auth_limits WHERE id=?").bind(key).first();
  if(attempts&&attempts.reset_at>Date.now()&&attempts.count>=8)return json({error:"Too many login attempts. Try again later."},429);
  const b=await payload(req);if(String(b.password||"")!==env.ADMIN_PASSWORD){
   const count=attempts&&attempts.reset_at>Date.now()?attempts.count+1:1;
   await env.DB.prepare("INSERT INTO auth_limits (id,count,reset_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at").bind(key,count,Date.now()+900000).run();
   return json({error:"Incorrect password"},401);
  }
  await env.DB.prepare("DELETE FROM auth_limits WHERE id=?").bind(key).run();
  const exp=String(Date.now()+8*3600000);const token=exp+"."+(await sign(env.SESSION_SECRET,exp));
  return json({ok:true},200,{"set-cookie":`aeroflow_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
 }
 if(path==="/api/logout"&&method==="POST")return json({ok:true},200,{"set-cookie":"aeroflow_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"});
 if(path.startsWith("/api/admin/")){
  if(!await authorized(req,env))return json({error:"Please sign in"},401);
  if(path==="/api/admin/data"&&method==="GET")return json(await adminData(env));
  if(path==="/api/admin/leads"&&method==="PATCH"){
   const b=await payload(req);const status=clean(b.status,30),notes=clean(b.notes,2000);
   if(!STATUS.includes(status))return json({error:"Invalid status"},400);
   const result=await env.DB.prepare("UPDATE inquiries SET status=?,admin_notes=? WHERE id=?").bind(status,notes,clean(b.id,100)).run();
   return json({ok:result.meta.changes>0});
  }
  if(path==="/api/admin/leads"&&method==="DELETE"){
   const b=await payload(req);await env.DB.prepare("DELETE FROM inquiries WHERE id=?").bind(clean(b.id,100)).run();return json({ok:true});
  }
  if(path==="/api/admin/settings"&&method==="PUT"){
   const b=await payload(req);for(const k of Object.keys(DEFAULT_SETTINGS))if(b[k]!==undefined)await env.DB.prepare("INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k,clean(b[k],200)).run();
   return json({ok:true});
  }
  if(path==="/api/admin/services"&&method==="PUT"){
   const b=await payload(req);if(!Array.isArray(b.services)||b.services.length!==6)return json({error:"Expected six services"},400);
   const ids=b.services.map(s=>clean(s.id,40));if(new Set(ids).size!==6||ids.some(id=>!DEFAULT_SERVICES.some(s=>s.id===id)))return json({error:"Invalid service IDs"},400);
   for(const s of b.services)await env.DB.prepare("INSERT INTO services (id,name,description,enabled) VALUES (?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,enabled=1").bind(clean(s.id,40),clean(s.title,90),clean(s.desc,250)).run();
   return json({ok:true});
  }
  if(path==="/api/admin/export"&&method==="GET"){
   const leads=(await adminData(env)).leads;const cols=["id","createdAt","name","email","phone","service","date","status","message","notes"];
   const csv=[cols.join(","),...leads.map(l=>cols.map(k=>'"'+String(l[k]||"").replace(/^[=+@-]/,"\t$&").replace(/"/g,'""')+'"').join(","))].join("\r\n");
   return new Response("\ufeff"+csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="aeroflow-leads.csv"',"cache-control":"no-store"}});
  }
 }
 return json({error:"Not found"},404);
}
export default {async fetch(req,env){
 const path=new URL(req.url).pathname;
 if(!path.startsWith("/api/"))return env.ASSETS.fetch(req);
 try{
  if(!env.DB)return json({error:"Database binding missing"},503);
  return await api(req,env,path);
 }catch(err){console.error("AeroFlow API error",err);return json({error:"Unable to complete request."},500)}
}};
