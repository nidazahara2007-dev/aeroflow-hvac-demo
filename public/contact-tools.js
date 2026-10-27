(() => {
  const style=document.createElement('link');style.rel='stylesheet';style.href='/contact-tools.css';document.head.append(style);
  const root=document.createElement('div');root.className='contact-dock';
  root.innerHTML=`<button class="dock-toggle" type="button" aria-label="Open contact options" aria-expanded="false">✳ <span>LET’S TALK</span></button><div class="dock-panel" hidden><div class="dock-head"><strong>How can we help?</strong><button class="dock-close" type="button" aria-label="Close contact options">×</button></div><p class="dock-intro">Explore contact options for this concept website.</p><div class="dock-links"></div><button type="button" class="dock-chat">✦ Ask the demo assistant</button><div class="dock-chatbox" hidden><div class="dock-messages" aria-live="polite"><p><b>AeroFlow assistant (demo)</b><br>Hi! Ask about services, maintenance or estimates.</p></div><form class="dock-chat-form"><input aria-label="Your question" placeholder="Ask about HVAC services..." maxlength="240" required><button type="submit">Send</button></form><small>Rule-based demo assistant, not a live AI agent.</small></div><small class="dock-disclaimer">Fictional HVAC company · No actual service provided</small></div>`;
  document.body.append(root);
  const toggle=root.querySelector('.dock-toggle'),panel=root.querySelector('.dock-panel');
  function show(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
  toggle.addEventListener('click',()=>show(panel.hidden));root.querySelector('.dock-close').addEventListener('click',()=>show(false));
  root.querySelector('.dock-chat').addEventListener('click',()=>{const box=root.querySelector('.dock-chatbox');box.hidden=!box.hidden;});
  const links=root.querySelector('.dock-links');
  function add(label,href,icon){const a=document.createElement('a');a.href=href;a.textContent=icon+' '+label;a.target=href.startsWith('https:')?'_blank':'_self';if(a.target==='_blank')a.rel='noopener noreferrer';links.append(a);}
  add('Request an estimate','/#contact','↗');
  fetch('/api/public').then(r=>r.ok?r.json():Promise.reject()).then(({settings})=>{
    const phone=String(settings.phone||'').trim(),email=String(settings.email||'').trim();
    const digits=phone.replace(/\D/g,'');
    if(phone && /^[+()\d .-]{7,25}$/.test(phone))add('Call '+phone,'tel:'+phone.replace(/[^+\d]/g,''),'☎');
    if(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))add('Send an email','mailto:'+email,'✉');
    if(digits.length>=9 && digits.length<=15)add('WhatsApp business','https://wa.me/'+digits,'◉');
    if(!phone&&!email){const tip=document.createElement('p');tip.className='dock-hint';tip.textContent='Call, email and WhatsApp buttons appear when the business owner enters verified contact details in Admin → Site settings.';links.append(tip);}
  }).catch(()=>{});
  function reply(q){const x=q.toLowerCase();if(/emergency|urgent|24\/?7/.test(x))return 'Emergency availability must be confirmed with the real HVAC business. This concept does not dispatch technicians.';if(/price|cost|quote|estimate/.test(x))return 'For a customized estimate, use the Request an Estimate form. This demo does not provide binding prices.';if(/repair|cool|ac|air condition/.test(x))return 'Cooling services can include AC installation, diagnostics and repair. Visit the Air Conditioning service page for details.';if(/heat|furnace/.test(x))return 'Heating services may include furnace inspections, repairs and replacements. Explore Heating & Furnaces in the Services section.';if(/maintenance|service|tune/.test(x))return 'Preventive maintenance typically involves system checks, cleaning and performance inspection according to equipment guidance.';if(/air quality|filter|ventilat/.test(x))return 'Indoor air quality solutions can include filtration, ventilation and humidity management.';return 'I can explain cooling, heating, maintenance, indoor air quality or estimate requests. For other questions, use the contact form.';}
  root.querySelector('.dock-chat-form').addEventListener('submit',e=>{e.preventDefault();const input=e.currentTarget.querySelector('input'),q=input.value.trim();if(!q)return;const messages=root.querySelector('.dock-messages');for(const [who,msg] of [['You',q],['Demo assistant',reply(q)]]){const item=document.createElement('p'),strong=document.createElement('b');strong.textContent=who;item.append(strong,document.createElement('br'),document.createTextNode(msg));messages.append(item);}messages.scrollTop=messages.scrollHeight;input.value='';});
  const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
})();
