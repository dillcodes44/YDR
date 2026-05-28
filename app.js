/* ============================================================
   Your Daily Ritual — app.js
   Personal wellness tracker. Vanilla JS, no framework.
   Persists to localStorage (or window.storage when inside Claude).
============================================================ */

/* ---------- storage abstraction ---------- */
const store={
  async get(k){
    if(window.storage){try{const r=await window.storage.get(k);return r?r.value:null;}catch(e){return null;}}
    try{return localStorage.getItem(k);}catch(e){return null;}
  },
  async set(k,v){
    if(window.storage){try{await window.storage.set(k,v);}catch(e){console.error(e);}return;}
    try{localStorage.setItem(k,v);}catch(e){console.error(e);}
  }
};

/* ---------- constants ---------- */
const K={
  profile:'ydr_profile', habits:'ydr_habits', days:'ydr_days',
  school:'ydr_school', vision:'ydr_vision', routines:'ydr_routines',
  reviews:'ydr_reviews', pomo:'ydr_pomo'
};

const CATS={event:'#4f6f52',homework:'#bd6e3a',study:'#c89b3c',workout:'#2f7d6b',gaming:'#7a6f9b',personal:'#c0607a'};
const catColor=c=>CATS[c]||CATS.event;

const CLASS_PALETTE=['#4f6f52','#bd6e3a','#c89b3c','#2f7d6b','#7a6f9b','#c0607a','#7d8a4a','#5e6f8c'];

const MOOD_WHEEL={
  'Happy':   {color:'#c89b3c', subs:['Proud','Content','Grateful','Hopeful','Excited','Peaceful','Optimistic','Loved']},
  'Sad':     {color:'#5e6f8c', subs:['Lonely','Disappointed','Hurt','Hopeless','Tired','Empty','Down','Heartbroken']},
  'Angry':   {color:'#bd4a3a', subs:['Frustrated','Irritated','Resentful','Annoyed','Bitter','Jealous','Furious']},
  'Anxious': {color:'#7a6f9b', subs:['Worried','Stressed','Overwhelmed','Insecure','Nervous','Scared','Restless']},
  'Calm':    {color:'#4f6f52', subs:['Relaxed','Focused','Centered','Steady','Quiet','Reflective']},
  'Bad':     {color:'#7d6248', subs:['Ashamed','Guilty','Embarrassed','Confused','Numb','Disconnected']}
};

const DOW=['S','M','T','W','T','F','S'];

/* ---------- state ---------- */
let state={
  profile:{name:'',unit:'lb',theme:'light'},
  habits:[], days:{},
  school:{classes:[],assignments:[],study:[]},
  vision:{goals:[],aspirations:[],money:[]},
  routines:[], reviews:{},
  pomo:{mode:'focus',running:false,remaining:25*60,endTime:null,sessions:0}
};
let tab='today', planView='day', planDate='', planCat='event', moodCoreOpen=null;
let pomoTimer=null;

/* ---------- helpers ---------- */
const uid=()=>Math.random().toString(36).slice(2,9);
const ymd=d=>{const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;};
const todayKey=()=>ymd(new Date());
const esc=s=>(s==null?'':String(s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function lastN(n){const a=[];for(let i=0;i<n;i++){const d=new Date();d.setDate(d.getDate()-i);a.push(ymd(d));}return a;}
function weekDaysOf(pivot){const d=new Date(pivot+'T00:00');d.setDate(d.getDate()-d.getDay());const a=[];for(let i=0;i<7;i++){const x=new Date(d);x.setDate(d.getDate()+i);a.push(ymd(x));}return a;}
function monthCellsOf(pivot){const d=new Date(pivot+'T00:00');const first=new Date(d.getFullYear(),d.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());const a=[];for(let i=0;i<42;i++){const x=new Date(start);x.setDate(start.getDate()+i);a.push({key:ymd(x),m:x.getMonth(),d:x.getDate()});}return a;}
function weekKey(d){const dt=new Date(d+'T00:00');dt.setDate(dt.getDate()-dt.getDay());return ymd(dt);}
function fmtDate(k){
  const d=new Date(k+'T00:00'),tk=todayKey();
  const rel=k===tk?'Today':k===ymd(new Date(Date.now()+864e5))?'Tomorrow':k===ymd(new Date(Date.now()-864e5))?'Yesterday':'';
  const txt=d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  return rel?`${rel} · ${txt}`:txt;
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const val=id=>{const e=document.getElementById(id);return e?e.value.trim():'';};

planDate=todayKey();

function getDay(k){
  let d=state.days[k]||{};
  d.intention=d.intention||'';
  d.mood=d.mood||''; d.energy=d.energy||''; d.feelings=d.feelings||[];
  d.goals=d.goals||[]; d.schedule=d.schedule||[];
  d.sleep=d.sleep||{hours:'',quality:0};
  d.water=d.water||0; d.protein=d.protein||0; d.meals=d.meals||[]; d.workouts=d.workouts||[];
  d.readMins=d.readMins||0; d.learned=d.learned||[]; d.meditateMins=d.meditateMins||0;
  d.gratitude=d.gratitude||[]; d.journal=d.journal||''; d.weight=d.weight||'';
  state.days[k]=d; return d;
}
const today=()=>getDay(todayKey());

/* ---------- theme ---------- */
function applyTheme(){
  document.documentElement.dataset.theme = state.profile.theme==='dark'?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = state.profile.theme==='dark'?'#1d1814':'#4f6f52';
}
function toggleTheme(){
  state.profile.theme = state.profile.theme==='dark'?'light':'dark';
  applyTheme(); queueSave('profile'); render();
}

/* ---------- save / load ---------- */
let saveTimer=null; const dirty=new Set();
function queueSave(w){dirty.add(w);clearTimeout(saveTimer);saveTimer=setTimeout(flush,500);}
function flush(){
  dirty.forEach(w=>{
    if(w==='days')store.set(K.days,JSON.stringify(state.days));
    if(w==='habits')store.set(K.habits,JSON.stringify(state.habits));
    if(w==='school')store.set(K.school,JSON.stringify(state.school));
    if(w==='vision')store.set(K.vision,JSON.stringify(state.vision));
    if(w==='profile')store.set(K.profile,JSON.stringify(state.profile));
    if(w==='routines')store.set(K.routines,JSON.stringify(state.routines));
    if(w==='reviews')store.set(K.reviews,JSON.stringify(state.reviews));
    if(w==='pomo')store.set(K.pomo,JSON.stringify(state.pomo));
  });
  dirty.clear();
}

async function load(){
  const p=await store.get(K.profile); if(p)try{Object.assign(state.profile,JSON.parse(p));}catch(e){}
  applyTheme();

  const h=await store.get(K.habits);
  if(h){try{state.habits=JSON.parse(h);}catch(e){}}
  else{
    state.habits=[
      {id:uid(),name:'Move my body / workout',completed:{}},
      {id:uid(),name:'Hit my protein',completed:{}},
      {id:uid(),name:'Walk / get my steps',completed:{}},
      {id:uid(),name:'Sleep 7+ hours',completed:{}},
      {id:uid(),name:'Read or learn something',completed:{}},
      {id:uid(),name:'Time outside / fresh air',completed:{}},
      {id:uid(),name:'No phone first 30 min',completed:{}}
    ];
    queueSave('habits');
  }
  const d=await store.get(K.days); if(d)try{state.days=JSON.parse(d);}catch(e){}
  const s=await store.get(K.school); if(s)try{
    const sc=JSON.parse(s);
    state.school.classes=sc.classes||[]; state.school.assignments=sc.assignments||[]; state.school.study=sc.study||[];
    state.school.assignments.forEach(a=>{a.completeBy=a.completeBy||''; a.classId=a.classId||'';});
  }catch(e){}
  const v=await store.get(K.vision); if(v)try{Object.assign(state.vision,JSON.parse(v));}catch(e){}
  const r=await store.get(K.routines); if(r)try{state.routines=JSON.parse(r);}catch(e){}
  const rv=await store.get(K.reviews); if(rv)try{state.reviews=JSON.parse(rv);}catch(e){}
  const pm=await store.get(K.pomo); if(pm)try{Object.assign(state.pomo,JSON.parse(pm));}catch(e){}

  pomoSettle(true);
  renderHeader(); render();
  startPomoTick();
}

/* ---------- header ---------- */
const greetWord=()=>{const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening';};
function renderHeader(){
  document.getElementById('greeting').innerHTML=`${greetWord()}, <span class="name" id="nameEdit">${esc(state.profile.name)||'friend'}</span>`;
  document.getElementById('subdate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  document.getElementById('nameEdit').onclick=()=>{
    const n=prompt('What should I call you?',state.profile.name||'');
    if(n!==null){state.profile.name=n.trim();queueSave('profile');renderHeader();}
  };
}
document.getElementById('gearBtn').onclick=()=>{
  if(tab==='settings'){ tab='today'; setNavActive('today'); }
  else{ tab='settings'; setNavActive(null); }
  render();
};
function setNavActive(name){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
}
document.querySelectorAll('#nav button').forEach(b=>{
  b.onclick=()=>{tab=b.dataset.tab;setNavActive(tab);render();};
});

function streakOf(h){let c=0,d=new Date();if(!h.completed[ymd(d)])d.setDate(d.getDate()-1);while(h.completed[ymd(d)]){c++;d.setDate(d.getDate()-1);}return c;}
const checkSvg='<svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"/></svg>';

/* ---------- ui helpers ---------- */
function counter(key,v,unit){return `<div class="counter">
  <button class="cbtn" data-act="${key}-minus">−</button>
  <div class="cval"><span>${v}</span><small>${unit}</small></div>
  <button class="cbtn" data-act="${key}-plus">+</button></div>`;}
function pills(act,cur,opts){return `<div class="pills">`+opts.map(o=>`<button class="pill ${cur===o?'on':''}" data-act="${act}" data-val="${o}">${o}</button>`).join('')+`</div>`;}
function weightEntries(){return Object.keys(state.days).filter(k=>parseFloat(state.days[k].weight)>0).sort().map(k=>({date:k,val:parseFloat(state.days[k].weight)}));}
function spark(entries){
  if(entries.length<2)return '';
  const pts=entries.slice(-24),vals=pts.map(p=>p.val),mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1,W=280,H=48,st=W/(pts.length-1);
  const c=pts.map((p,i)=>`${(i*st).toFixed(1)},${(H-5-((p.val-mn)/rng)*(H-10)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="48" preserveAspectRatio="none" style="margin-top:14px"><polyline points="${c}" fill="none" stroke="var(--sage)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ---------- render dispatch ---------- */
const view=document.getElementById('view');
function render(){
  ({today:renderToday, plan:renderPlan, body:renderBody, mind:renderMind,
    school:renderSchool, vision:renderVision, settings:renderSettings})[tab]();
}
function setTab(name){tab=name;setNavActive(name);render();}

/* =====================================================
   TODAY
===================================================== */
function renderToday(){
  const day=today(), tk=todayKey();

  const goals=day.goals.map(g=>`<div class="row ${g.done?'done':''}">
    <button class="check ${g.done?'on':''}" data-act="goal-toggle" data-id="${g.id}">${checkSvg}</button>
    <input class="txt" value="${esc(g.text)}" data-act="goal-text" data-id="${g.id}" placeholder="What matters today?">
    <button class="del" data-act="goal-del" data-id="${g.id}">×</button></div>`).join('')||'<div class="empty">Add your top 1–3 priorities for today.</div>';

  const habits=state.habits.map(h=>{const on=!!h.completed[tk],s=streakOf(h);
    return `<div class="row ${on?'done':''}"><button class="check ${on?'on':''}" data-act="habit-toggle" data-id="${h.id}">${checkSvg}</button>
    <span class="label">${esc(h.name)}</span>${s>0?`<span class="streak">${s}🔥</span>`:''}</div>`;}).join('')||'<div class="empty">Add habits in Vision → manage.</div>';

  const sched=day.schedule.map(s=>`<div class="row" style="border-left:3px solid ${catColor(s.cat)};padding-left:11px${s.done?';opacity:.55':''}">
    <button class="check ${s.done?'on':''}" data-act="sch-toggle" data-id="${s.id}">${checkSvg}</button>
    <input class="time" value="${esc(s.time)}" data-act="sch-time" data-id="${s.id}" placeholder="9:00">
    <input class="txt" value="${esc(s.text)}" data-act="sch-text" data-id="${s.id}" placeholder="Activity">
    <button class="del" data-act="sch-del" data-id="${s.id}">×</button></div>`).join('')||'<div class="empty">Nothing planned yet — add below or use the Schedule tab.</div>';

  view.innerHTML=`
    ${cardIntention(day)}
    ${cardMood(day)}
    ${cardPomo()}
    <div class="card"><div class="ctitle">Top priorities</div>
      <div class="chint">Pick 1–3. Fewer, finished beats many, started.</div>${goals}
      <div class="addrow"><input id="goalIn" placeholder="Add a priority…"><button data-act="goal-add">Add</button></div></div>
    <div class="card"><div class="ctitle">Daily habits</div>
      <div class="chint">Small reps, every day. That's the whole game.</div>${habits}</div>
    <div class="card"><div class="ctitle">Schedule</div>
      <div class="chint">Time-block your day so it doesn't run you.</div>${sched}
      <div class="addrow"><input id="schTime" class="sm" placeholder="9:00"><input id="schText" placeholder="What's happening…"><button data-act="sch-add">Add</button></div></div>`;
  wire();
}

function cardIntention(day){
  return `<div class="card intention"><div class="ctitle">Today's intention</div>
    <div class="chint">One line. What energy are you bringing today?</div>
    <input id="f_intention" data-act="intention" value="${esc(day.intention)}" placeholder="Show up for myself, one rep at a time."></div>`;
}

function cardMood(day){
  const core=Object.keys(MOOD_WHEEL).map(c=>`<button class="corep ${moodCoreOpen===c?'on':''}" data-act="mood-core" data-val="${c}" style="--cc:${MOOD_WHEEL[c].color}"><span class="dot"></span>${c}</button>`).join('');
  let subs='';
  if(moodCoreOpen){
    const arr=MOOD_WHEEL[moodCoreOpen].subs;
    subs=`<div class="subfeels">${arr.map(f=>`<button class="subp ${day.feelings.includes(f)?'on':''}" data-act="feel-toggle" data-val="${f}">${f}</button>`).join('')}</div>`;
  }
  const chips=day.feelings.length?`<div class="feelchips">${day.feelings.map(f=>`<span class="feelchip">${esc(f)}<button data-act="feel-del" data-val="${esc(f)}">×</button></span>`).join('')}</div>`:'';
  return `<div class="card"><div class="ctitle">How are you?</div>
    <div class="field"><label>Overall</label>${pills('mood',day.mood,['Rough','Low','Okay','Good','Great'])}</div>
    <div class="field"><label>Energy</label>${pills('energy',day.energy,['Low','Medium','High'])}</div>
    <div class="field" style="margin-bottom:0"><label>What you're feeling — tap a category, then specifics</label>
      <div class="moodcore">${core}</div>${subs}${chips}
    </div></div>`;
}

function cardPomo(){
  const p=state.pomo;
  const remaining=p.running ? Math.max(0, Math.floor((p.endTime-Date.now())/1000)) : p.remaining;
  const mm=String(Math.floor(remaining/60)).padStart(2,'0'), ss=String(remaining%60).padStart(2,'0');
  const total=p.mode==='focus'?25*60:5*60;
  const pct=Math.max(0, Math.min(1, remaining/total));
  const C=2*Math.PI*55; // circumference for r=55
  const off=C*(1-pct);
  return `<div class="card"><div class="ctitle">Focus timer</div>
    <div class="chint">25-minute focus block, then 5-minute break. Pomodoro keeps you honest.</div>
    <div class="pomo">
      <div class="pomoring ${p.mode==='break'?'brk':''}">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle class="bg" cx="65" cy="65" r="55" fill="none" stroke-width="8"></circle>
          <circle id="pomoRing" class="fg" cx="65" cy="65" r="55" fill="none" stroke-width="8" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>
        </svg>
        <div class="pomotxt"><div class="t" id="pomoTime">${mm}:${ss}</div><div class="m" id="pomoMode">${p.mode==='focus'?'Focus':'Break'} · ${p.sessions||0} done</div></div>
      </div>
      <div class="pomoctl">
        ${p.running?`<button data-act="pomo-pause">Pause</button>`:`<button data-act="pomo-start">${remaining<total?'Resume':'Start'}</button>`}
        <button class="alt" data-act="pomo-reset">Reset</button>
        <button class="alt" data-act="pomo-skip">Skip ${p.mode==='focus'?'to break':'to focus'}</button>
      </div>
    </div></div>`;
}

/* =====================================================
   SCHEDULE
===================================================== */
function viewSwitcher(){return `<div class="seg">${['day','week','month','routines'].map(v=>`<button class="segb ${planView===v?'on':''}" data-act="view" data-val="${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div>`;}

function renderPlan(){({day:renderPlanDay,week:renderPlanWeek,month:renderPlanMonth,routines:renderRoutines})[planView]();}

function renderPlanDay(){
  const sd=getDay(planDate);
  const items=[...sd.schedule].sort((a,b)=>(a.time||'~').localeCompare(b.time||'~'));
  const list=items.map(s=>`<div class="row" style="border-left:3px solid ${catColor(s.cat)};padding-left:11px${s.done?';opacity:.55':''}">
    <button class="check ${s.done?'on':''}" data-act="sch-toggle" data-id="${s.id}">${checkSvg}</button>
    <input class="time" value="${esc(s.time)}" data-act="sch-time" data-id="${s.id}" placeholder="––:––">
    <input class="txt" value="${esc(s.text)}" data-act="sch-text" data-id="${s.id}" placeholder="What's happening">
    <button class="del" data-act="sch-del" data-id="${s.id}">×</button></div>`).join('')||'<div class="empty">Open day. Add events, study, gaming — whatever\'s on.</div>';
  const due=state.school.assignments.filter(a=>!a.done && (a.completeBy===planDate || a.due===planDate));
  const dueBanner=due.length?`<div class="duebanner">📌 Due / target this day: ${due.map(a=>esc(a.text)).join(', ')}</div>`:'';
  const catPills=Object.keys(CATS).map(c=>`<button class="pill cat ${planCat===c?'on':''}" data-act="plancat" data-val="${c}" style="--cc:${CATS[c]}">${c[0].toUpperCase()+c.slice(1)}</button>`).join('');
  const rApply=state.routines.length?`<div class="addrow" style="margin-top:10px"><select id="rApply">${state.routines.map(r=>`<option value="${r.id}">${esc(r.name||'Untitled routine')}</option>`).join('')}</select><button data-act="routine-apply-day">Apply routine</button></div>`:'';
  view.innerHTML=`${viewSwitcher()}
    <div class="card">
      <div class="datenav"><button class="navbtn" data-act="plan-prev">‹</button>
        <div class="dlabel">${fmtDate(planDate)}</div>
        <button class="navbtn" data-act="plan-next">›</button></div>
      ${planDate!==todayKey()?`<div style="text-align:center;margin:-4px 0 12px"><button class="ghost" data-act="plan-today">Jump to today</button></div>`:''}
      ${dueBanner}${list}
      <div class="addrow"><input id="schTime" class="sm" placeholder="9:00"><input id="schText" placeholder="Add to this day…"><button data-act="sch-add">Add</button></div>
      <div class="catrow">${catPills}</div>
      ${rApply}
      <div class="chint" style="margin:14px 0 0">Pick a type before adding. Schedule any assignment from the School tab — it drops onto its target date here.</div>
    </div>`;
  wire();
}

function renderPlanWeek(){
  const days=weekDaysOf(planDate),tk=todayKey();
  const first=new Date(days[0]+'T00:00'),last=new Date(days[6]+'T00:00');
  const range=`${first.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${last.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
  const dayBlocks=days.map(k=>{
    const sd=getDay(k),items=[...sd.schedule].sort((a,b)=>(a.time||'~').localeCompare(b.time||'~'));
    const due=state.school.assignments.filter(a=>!a.done && (a.completeBy===k || a.due===k));
    const evs=items.map(s=>`<div class="wkitem ${s.done?'done':''}"><span class="swatch" style="background:${catColor(s.cat)}"></span><span class="wt">${esc(s.time||'—')}</span><span class="wtxt">${esc(s.text)}</span></div>`).join('');
    const dueChips=due.map(a=>`<span class="duechip">${esc(a.text)}</span>`).join('');
    const lbl=new Date(k+'T00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    return `<div class="wkday ${k===tk?'today':''}"><div class="wkhead" data-act="plan-jump" data-val="${k}"><span class="name">${lbl}</span><span class="num">${items.length} item${items.length===1?'':'s'} ›</span></div>${dueChips?`<div style="margin-top:8px">${dueChips}</div>`:''}${evs}</div>`;
  }).join('');
  view.innerHTML=`${viewSwitcher()}
    <div class="card">
      <div class="datenav"><button class="navbtn" data-act="week-prev">‹</button>
        <div class="dlabel">${range}</div>
        <button class="navbtn" data-act="week-next">›</button></div>
      <div style="text-align:center;margin:-4px 0 14px"><button class="ghost" data-act="plan-today">Jump to this week</button></div>
      ${dayBlocks}
      <div class="chint" style="margin-top:8px">Tap any day to open it for editing.</div>
    </div>`;
  wire();
}

function renderPlanMonth(){
  const cells=monthCellsOf(planDate),pivotM=new Date(planDate+'T00:00').getMonth(),tk=todayKey();
  const label=new Date(planDate+'T00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const head=DOW.map(d=>`<div>${d}</div>`).join('');
  const grid=cells.map(c=>{
    if(c.m!==pivotM) return `<div class="mcell dim">${c.d}</div>`;
    const sd=state.days[c.key]; const evs=sd&&sd.schedule?sd.schedule:[];
    const due=state.school.assignments.filter(a=>!a.done && (a.completeBy===c.key || a.due===c.key));
    const cats=[...new Set(evs.map(e=>e.cat||'event'))].slice(0,4);
    const dots=cats.map(cc=>`<span class="ddot" style="background:${catColor(cc)}"></span>`).join('')+(due.length?`<span class="ddot" style="background:var(--clay)"></span>`:'');
    const extra=evs.length+due.length>4?`<span class="more">+${evs.length+due.length-4}</span>`:'';
    return `<div class="mcell ${c.key===tk?'today':''} ${c.key===planDate?'sel':''}" data-act="plan-jump" data-val="${c.key}">${c.d}<div class="ddots">${dots}${extra}</div></div>`;
  }).join('');
  view.innerHTML=`${viewSwitcher()}
    <div class="card">
      <div class="datenav"><button class="navbtn" data-act="month-prev">‹</button>
        <div class="dlabel">${label}</div>
        <button class="navbtn" data-act="month-next">›</button></div>
      <div style="text-align:center;margin:-4px 0 12px"><button class="ghost" data-act="plan-today">Today</button></div>
      <div class="mhead">${head}</div>
      <div class="mgrid">${grid}</div>
      <div class="chint" style="margin-top:12px">Dots show category colors. Clay dot = assignment due. Tap a day to open it.</div>
    </div>`;
  wire();
}

function renderRoutines(){
  const opts=Object.keys(CATS).map(c=>`<option value="${c}">${c[0].toUpperCase()+c.slice(1)}</option>`).join('');
  const list=state.routines.map(r=>{
    const dowBtns=DOW.map((d,i)=>`<button class="dowb ${(r.days||[]).includes(i)?'on':''}" data-act="r-dow" data-id="${r.id}" data-val="${i}">${d}</button>`).join('');
    const items=(r.items||[]).map(it=>`<div class="ritem">
      <span class="swatch" style="background:${catColor(it.cat)}"></span>
      <input class="rt" value="${esc(it.time)}" data-act="ri-time" data-id="${r.id}" data-iid="${it.id}" placeholder="7:00">
      <input class="rx" value="${esc(it.text)}" data-act="ri-text" data-id="${r.id}" data-iid="${it.id}" placeholder="What you do">
      <select data-act="ri-cat" data-id="${r.id}" data-iid="${it.id}">${Object.keys(CATS).map(c=>`<option value="${c}" ${it.cat===c?'selected':''}>${c[0].toUpperCase()+c.slice(1)}</option>`).join('')}</select>
      <button class="del" data-act="ri-del" data-id="${r.id}" data-iid="${it.id}">×</button></div>`).join('')||'<div class="empty">No steps yet — add one below.</div>';
    return `<div class="routine">
      <input class="rname" value="${esc(r.name)}" data-act="r-name" data-id="${r.id}" placeholder="Routine name (e.g. Weekday morning)">
      <div class="chint" style="margin-top:6px">Runs on:</div>
      <div class="dow">${dowBtns}</div>
      ${items}
      <div class="addrow" style="margin-top:10px"><input class="sm" data-rid="${r.id}" id="rt_${r.id}" placeholder="7:00"><input data-rid="${r.id}" id="rx_${r.id}" placeholder="Add a step…"><select data-rid="${r.id}" id="rc_${r.id}">${opts}</select><button data-act="ri-add" data-id="${r.id}">Add</button></div>
      <div class="ractions"><button class="ghost" data-act="r-apply-today" data-id="${r.id}">Apply to today</button><button class="ghost" data-act="r-apply-week" data-id="${r.id}">Apply this week</button><button class="ghost" data-act="r-del" data-id="${r.id}" style="color:var(--danger);border-color:var(--danger-soft)">Delete</button></div>
    </div>`;
  }).join('')||'<div class="empty">No routines yet. A routine is a set of recurring time-blocks — like a weekday morning, an after-school study block, or a weekend wind-down. Build one below and apply it to today or your whole week.</div>';
  view.innerHTML=`${viewSwitcher()}
    <div class="card">
      <div class="ctitle">Routines</div>
      <div class="chint">Build templates once. Apply to today or every matching day this week.</div>
      ${list}
      <div class="addrow" style="margin-top:14px"><input id="rNew" placeholder="New routine name (e.g. Morning, Study block)"><button data-act="r-add">＋ Create</button></div>
    </div>`;
  wire();
}

/* =====================================================
   BODY
===================================================== */
function renderBody(){
  const day=today();
  const sl=lastN(7).map(k=>state.days[k]&&state.days[k].sleep&&parseFloat(state.days[k].sleep.hours)).filter(x=>x>0);
  const slAvg=sl.length?(sl.reduce((a,b)=>a+b,0)/sl.length).toFixed(1):null;
  const stars=[1,2,3,4,5].map(n=>`<button class="star ${day.sleep.quality>=n?'on':''}" data-act="sleep-q" data-val="${n}"></button>`).join('');
  const meals=day.meals.map(m=>`<div class="row"><span class="label">${esc(m.text)}</span><button class="del" data-act="meal-del" data-id="${m.id}">×</button></div>`).join('')||'<div class="empty">Log what you ate — no calorie math, just awareness.</div>';
  const workouts=day.workouts.map(w=>`<div class="row"><span class="label">${esc(w.type)}${w.mins?` <span class="meta">· ${esc(w.mins)} min</span>`:''}${w.note?`<br><span class="meta">${esc(w.note)}</span>`:''}</span><button class="del" data-act="wo-del" data-id="${w.id}">×</button></div>`).join('')||'<div class="empty">Log today\'s movement.</div>';
  const woWeek=lastN(7).reduce((n,k)=>n+((state.days[k]&&state.days[k].workouts)?state.days[k].workouts.length:0),0);
  const unit=state.profile.unit||'lb';
  const we=weightEntries(),wk=lastN(7),pwk=lastN(14).slice(7);
  const thisAvg=avg(we.filter(e=>wk.includes(e.date)).map(e=>e.val));
  const lastAvg=avg(we.filter(e=>pwk.includes(e.date)).map(e=>e.val));
  let delta=null,dDir='flat';
  if(thisAvg!=null&&lastAvg!=null){delta=thisAvg-lastAvg;dDir=delta<-0.05?'down':delta>0.05?'up':'flat';}
  const weightCard=`<div class="card"><div class="ctitle">Weight</div>
    <div class="chint">Weigh in around the same time each day. Track the weekly average, not the daily bounce.</div>
    <div class="weighrow"><input type="number" step="0.1" class="wt" id="f_weight" data-act="weight" value="${esc(String(day.weight))}" placeholder="–">
      <span class="wunit">${unit}</span><div class="pills" style="margin-left:auto">${['lb','kg'].map(u=>`<button class="pill ${unit===u?'on':''}" data-act="unit" data-val="${u}">${u}</button>`).join('')}</div></div>
    ${thisAvg!=null?`<div class="wstats">
      <div class="wstat"><b>${thisAvg.toFixed(1)}</b><small>this week avg</small></div>
      ${lastAvg!=null?`<div class="wstat"><b>${lastAvg.toFixed(1)}</b><small>last week avg</small></div>`:''}
      ${delta!=null?`<div class="wstat ${dDir}"><b>${delta>0?'+':''}${delta.toFixed(1)}</b><small>${dDir==='down'?'▼ down':dDir==='up'?'▲ up':'steady'}</small></div>`:''}
    </div>`:'<div class="empty">Log a few days and your weekly average appears here.</div>'}
    ${spark(we)}</div>`;
  view.innerHTML=`
    ${weightCard}
    <div class="card"><div class="ctitle">Sleep</div>
      <div class="chint">Recovery is where the muscle's built and the mind resets.</div>
      <div class="sleep-grid"><div class="hrs"><input type="number" step="0.5" min="0" max="24" id="f_sleephours" data-act="sleep-hours" value="${esc(String(day.sleep.hours))}" placeholder="–"><div class="chint" style="margin:4px 0 0">hours slept</div></div>
        <div><div class="chint" style="margin:0 0 6px">quality</div><div class="stars">${stars}</div></div></div>
      ${slAvg?`<div class="stat">7-day average: ${slAvg} hrs</div>`:''}</div>
    <div class="card"><div class="ctitle">Nutrition</div>
      <div class="chint">Two habits do most of the work: water + protein.</div>
      <div class="field"><label>Water (glasses)</label>${counter('water',day.water,'glasses')}</div>
      <div class="field"><label>Protein servings</label>${counter('protein',day.protein,'servings')}</div>
      <div class="field" style="margin-bottom:0"><label>Meals</label>${meals}
        <div class="addrow"><input id="mealIn" placeholder="e.g. Eggs + oats + fruit"><button data-act="meal-add">Add</button></div></div></div>
    <div class="card"><div class="ctitle">Movement</div>
      <div class="chint">Lift, walk, run, stretch — it all counts.</div>${workouts}
      <div class="addrow"><input id="woType" placeholder="Type (e.g. Full body)"><input id="woMins" class="sm" placeholder="min" inputmode="numeric"><button data-act="wo-add">Add</button></div>
      <div class="addrow" style="margin-top:8px"><input id="woNote" placeholder="Notes (optional)…"></div>
      <div class="stat">${woWeek} session${woWeek===1?'':'s'} this week</div></div>`;
  wire();
}

/* =====================================================
   MIND
===================================================== */
function renderMind(){
  const day=today();
  const learned=day.learned.map(l=>`<div class="row"><span class="label">${esc(l.text)}</span><button class="del" data-act="learn-del" data-id="${l.id}">×</button></div>`).join('')||'<div class="empty">One thing you read or learned today.</div>';
  const grat=day.gratitude.map(g=>`<div class="row"><span class="label">${esc(g.text)}</span><button class="del" data-act="grat-del" data-id="${g.id}">×</button></div>`).join('')||'<div class="empty">Name 1–3 things, however small.</div>';
  view.innerHTML=`
    <div class="card"><div class="ctitle">Read &amp; learn</div>
      <div class="chint">Feed your mind on purpose. Minutes add up.</div>
      <div class="field"><label>Minutes today</label>${counter('read',day.readMins,'minutes')}</div>
      <div class="field" style="margin-bottom:0"><label>What I learned / read</label>${learned}
        <div class="addrow"><input id="learnIn" placeholder="A book, idea, lesson…"><button data-act="learn-add">Add</button></div></div></div>
    <div class="card"><div class="ctitle">Mindfulness</div>
      <div class="chint">Quiet the noise. Even two minutes counts.</div>
      <div class="field" style="margin-bottom:0"><label>Meditation / breathwork</label>${counter('meditate',day.meditateMins,'minutes')}</div></div>
    <div class="card"><div class="ctitle">Gratitude</div>
      <div class="chint">Trains your brain to notice the good.</div>${grat}
      <div class="addrow"><input id="gratIn" placeholder="I'm grateful for…"><button data-act="grat-add">Add</button></div></div>
    <div class="card journal"><div class="ctitle">Reflection</div>
      <div class="chint">How did today actually go? Dump it here.</div>
      <textarea id="f_journal" data-act="journal" placeholder="Today I…">${esc(day.journal)}</textarea></div>`;
  wire();
}

/* =====================================================
   SCHOOL
===================================================== */
function renderSchool(){
  const sc=state.school;const tk=todayKey();
  const classes=sc.classes.map(c=>`<span class="classchip"><span class="swatch" style="background:${c.color}"></span>${esc(c.name)}<button data-act="cls-del" data-id="${c.id}">×</button></span>`).join('')||'<div class="empty">Add your classes first so assignments can be tagged and color-coded.</div>';
  const classOpts=`<option value="">— pick class —</option>`+sc.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');

  const asn=[...sc.assignments].sort((a,b)=>{
    const ad=a.completeBy||a.due||'9999', bd=b.completeBy||b.due||'9999';
    return ad.localeCompare(bd);
  }).map(a=>{
    const cls=sc.classes.find(c=>c.id===a.classId);
    const target=a.completeBy||a.due;
    let tag='';
    if(target){
      const diff=Math.round((new Date(target+'T00:00')-new Date(tk+'T00:00'))/864e5);
      const clsTag=diff<0?'over':diff<=2?'soon':'';
      const txt=diff<0?`${-diff}d late`:diff===0?'today':diff===1?'tomorrow':`in ${diff}d`;
      tag=`<span class="due ${clsTag}">${a.done?'done':txt}</span>`;
    }
    const meta=[
      cls?`<span style="color:${cls.color};font-weight:700">${esc(cls.name)}</span>`:'',
      a.due?`due ${esc(a.due)}`:'',
      a.completeBy&&a.completeBy!==a.due?`finish by ${esc(a.completeBy)}`:''
    ].filter(Boolean).join(' · ');
    return `<div class="row ${a.done?'done':''}" style="flex-wrap:wrap">
      <button class="check ${a.done?'on':''}" data-act="asn-toggle" data-id="${a.id}">${checkSvg}</button>
      <input class="txt" value="${esc(a.text)}" data-act="asn-text" data-id="${a.id}" placeholder="Assignment">
      ${a.done?'':tag}
      ${a.done?'':`<button class="ghost" style="padding:5px 10px;font-size:12px;margin:0" data-act="asn-schedule" data-id="${a.id}">＋ Plan</button>`}
      <button class="del" data-act="asn-del" data-id="${a.id}">×</button>
      ${meta?`<div class="asn-meta" style="flex-basis:100%;padding-left:36px;margin-top:2px">${meta}</div>`:''}
    </div>`;
  }).join('')||'<div class="empty">Add assignments and deadlines so nothing sneaks up.</div>';

  const study=lastN(7).reduce((n,k)=>n+(sc.study.filter(s=>s.date===k).reduce((m,s)=>m+(parseInt(s.mins)||0),0)),0);
  const recent=[...sc.study].slice(-6).reverse().map(s=>`<div class="row"><span class="label">${esc(s.subject)} <span class="meta">· ${esc(s.mins)} min</span></span><button class="del" data-act="study-del" data-id="${s.id}">×</button></div>`).join('')||'<div class="empty">Log your study sessions.</div>';

  view.innerHTML=`
    <div class="card"><div class="ctitle">Classes</div>
      <div class="chint">Add the classes you're taking. Assignments tag to a class for color-coding and per-class filtering.</div>
      <div>${classes}</div>
      <div class="addrow" style="margin-top:12px"><input id="clsIn" placeholder="Add a class (e.g. AP Bio)"><button data-act="cls-add">Add</button></div></div>

    <div class="card"><div class="ctitle">Assignments</div>
      <div class="chint">Soon/overdue runs off your <i>complete-by</i> date (the date you set to actually finish). The due date is the hard backstop.</div>${asn}
      <div class="addrow"><input id="asnText" placeholder="Assignment / task…"><select id="asnCls">${classOpts}</select></div>
      <div class="addrow" style="margin-top:8px">
        <label style="flex:1;min-width:140px;color:var(--ink-soft);font-size:12.5px">Due
          <input type="date" id="asnDue" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px 13px;font-family:inherit;background:var(--surface-2);color:var(--ink);margin-top:4px"></label>
        <label style="flex:1;min-width:140px;color:var(--ink-soft);font-size:12.5px">Complete by
          <input type="date" id="asnComp" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px 13px;font-family:inherit;background:var(--surface-2);color:var(--ink);margin-top:4px"></label>
        <button data-act="asn-add" style="align-self:flex-end">Add</button>
      </div></div>

    <div class="card"><div class="ctitle">Study log</div>
      <div class="chint">Track focused study time by subject.</div>${recent}
      <div class="addrow"><input id="stSub" placeholder="Subject"><input id="stMin" class="sm" placeholder="min" inputmode="numeric"><button data-act="study-add">Log</button></div>
      <div class="stat">${study} min studied this week</div></div>

    <div class="card"><div class="ctitle">Study tools</div>
      <div class="chint">Need flashcards or quiz questions? Paste your notes into Claude and ask. A built-in deck builder is coming.</div>
      <a class="ghost" href="https://claude.ai" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none">Open Claude →</a></div>`;
  wire();
}

/* =====================================================
   VISION (incl. weekly review)
===================================================== */
function renderVision(){
  const v=state.vision;
  const goals=v.goals.map(g=>`<div class="row ${g.done?'done':''}"><button class="check ${g.done?'on':''}" data-act="vg-toggle" data-id="${g.id}">${checkSvg}</button>
    <input class="txt" value="${esc(g.text)}" data-act="vg-text" data-id="${g.id}"><button class="del" data-act="vg-del" data-id="${g.id}">×</button></div>`).join('')||'<div class="empty">What do you want to achieve this month?</div>';
  const money=v.money.map(g=>`<div class="row ${g.done?'done':''}"><button class="check ${g.done?'on':''}" data-act="mn-toggle" data-id="${g.id}">${checkSvg}</button>
    <input class="txt" value="${esc(g.text)}" data-act="mn-text" data-id="${g.id}"><button class="del" data-act="mn-del" data-id="${g.id}">×</button></div>`).join('')||'<div class="empty">Steps toward your money / side-project goals.</div>';
  const asps=v.aspirations.map(a=>`<div class="asp"><span>${esc(a.text)}</span><button class="del" data-act="asp-del" data-id="${a.id}">×</button></div>`).join('')||'<div class="empty">The big stuff. Who are you becoming?</div>';
  const habitList=state.habits.map(h=>`<div class="row"><span class="label">${esc(h.name)}</span><button class="del" data-act="habit-del" data-id="${h.id}">×</button></div>`).join('')||'<div class="empty">No habits yet.</div>';
  view.innerHTML=`
    ${cardReview()}
    <div class="card"><div class="ctitle">Goals</div><div class="chint">This week / this month. Concrete and checkable.</div>${goals}
      <div class="addrow"><input id="vgIn" placeholder="Add a goal…"><button data-act="vg-add">Add</button></div></div>
    <div class="card"><div class="ctitle">Money &amp; side projects</div><div class="chint">Your online income goal, broken into real steps.</div>${money}
      <div class="addrow"><input id="mnIn" placeholder="e.g. Finish first freelance gig"><button data-act="mn-add">Add</button></div></div>
    <div class="card"><div class="ctitle">Aspirations</div><div class="chint">The horizon you're walking toward. Read these often.</div>${asps}
      <div class="addrow"><input id="aspIn" placeholder="Add an aspiration…"><button data-act="asp-add">Add</button></div></div>
    <div class="card"><div class="ctitle">Manage habits</div><div class="chint">Add anything — workouts, lifestyle, school. They show on Today.</div>${habitList}
      <div class="addrow"><input id="habitIn" placeholder="Add a habit…"><button data-act="habit-add">Add</button></div></div>
    <div class="card footer"><div class="quote">"You do not rise to the level of your goals. You fall to the level of your systems."</div></div>`;
  wire();
}

function cardReview(){
  const wk=weekKey(todayKey());
  const r=state.reviews[wk]||{wentWell:'',change:'',nextWeek:''};
  const past=Object.keys(state.reviews).filter(k=>k!==wk).sort().reverse().slice(0,6);
  const pastHtml=past.map(k=>{
    const rr=state.reviews[k];
    const wlbl=new Date(k+'T00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    return `<details><summary>Week of ${wlbl}</summary>
      <div class="rblock"><b>WENT WELL</b><br>${esc(rr.wentWell)||'<i>—</i>'}</div>
      <div class="rblock"><b>CHANGE</b><br>${esc(rr.change)||'<i>—</i>'}</div>
      <div class="rblock"><b>NEXT WEEK</b><br>${esc(rr.nextWeek)||'<i>—</i>'}</div></details>`;
  }).join('');
  return `<div class="card rev"><div class="ctitle">Weekly review</div>
    <div class="chint">Sunday-ish ritual. The single highest-leverage thing for compounding improvement.</div>
    <label>What went well this week?</label>
    <textarea id="rev_well" data-act="rev-well" placeholder="Wins. Streaks. Anything you did well.">${esc(r.wentWell)}</textarea>
    <label>What do you want to change?</label>
    <textarea id="rev_change" data-act="rev-change" placeholder="What didn't work. What you'll do differently.">${esc(r.change)}</textarea>
    <label>Top 3 for next week:</label>
    <textarea id="rev_next" data-act="rev-next" placeholder="1.&#10;2.&#10;3.">${esc(r.nextWeek)}</textarea>
    ${pastHtml?`<div class="revpast">${pastHtml}</div>`:''}
  </div>`;
}

/* =====================================================
   SETTINGS
===================================================== */
function renderSettings(){
  const t=state.profile.theme==='dark';
  view.innerHTML=`
    <div class="card">
      <div class="ctitle">Settings</div>
      <div class="chint">Tweak the app to your taste. More options coming.</div>
      <div class="setting">
        <div><div class="lbl">Dark mode</div><div class="desc">Warm dark theme — easier on the eyes at night.</div></div>
        <button class="toggle ${t?'on':''}" data-act="toggle-theme" aria-label="Toggle dark mode"></button>
      </div>
      <div class="setting">
        <div><div class="lbl">Your name</div><div class="desc">Used in the greeting.</div></div>
        <input id="set_name" data-act="set-name" value="${esc(state.profile.name)}" placeholder="Your name" style="border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:10px;padding:8px 12px;font-family:inherit;width:140px;max-width:50vw">
      </div>
      <div class="setting">
        <div><div class="lbl">Weight unit</div><div class="desc">Used in the Body tab.</div></div>
        <div class="pills">${['lb','kg'].map(u=>`<button class="pill ${state.profile.unit===u?'on':''}" data-act="unit" data-val="${u}">${u}</button>`).join('')}</div>
      </div>
    </div>
    <div class="card">
      <div class="ctitle">Your data</div>
      <div class="chint">Saved in your browser, on this device. Back it up regularly.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="ghost" data-act="export">Export backup (.json)</button>
        <button class="ghost" data-act="import">Import backup</button>
        <button class="ghost" data-act="wipe" style="color:var(--danger);border-color:var(--danger-soft)">Wipe everything</button>
      </div>
    </div>
    <div class="card footer">
      <div class="tip">Your Daily Ritual · open-source personal tracker. Built for you, by you. On your phone: open in your browser and "Add to Home Screen" to use it like an app.</div>
    </div>`;
  wire();
}

/* =====================================================
   POMODORO ENGINE
===================================================== */
function pomoSettle(silent){
  const p=state.pomo;
  if(p.running){
    const left=Math.floor((p.endTime-Date.now())/1000);
    if(left<=0){
      // session finished while away
      if(p.mode==='focus') p.sessions=(p.sessions||0)+1;
      p.mode = p.mode==='focus'?'break':'focus';
      p.remaining = p.mode==='focus'?25*60:5*60;
      p.running=false; p.endTime=null;
      queueSave('pomo');
      if(!silent) notifyDone(p.mode);
    } else {
      p.remaining=left;
    }
  }
}
function startPomoTick(){
  if(pomoTimer) clearInterval(pomoTimer);
  pomoTimer=setInterval(()=>{
    const p=state.pomo;
    if(!p.running) return;
    const left=Math.floor((p.endTime-Date.now())/1000);
    if(left<=0){
      if(p.mode==='focus') p.sessions=(p.sessions||0)+1;
      p.mode = p.mode==='focus'?'break':'focus';
      p.remaining = p.mode==='focus'?25*60:5*60;
      p.running=false; p.endTime=null;
      queueSave('pomo');
      notifyDone(p.mode);
      if(tab==='today') render();
    } else {
      p.remaining=left;
      updatePomoDom();
    }
  },1000);
}
function updatePomoDom(){
  const tEl=document.getElementById('pomoTime'); if(!tEl) return;
  const p=state.pomo;
  const mm=String(Math.floor(p.remaining/60)).padStart(2,'0'), ss=String(p.remaining%60).padStart(2,'0');
  tEl.textContent=`${mm}:${ss}`;
  const ring=document.getElementById('pomoRing'); if(ring){
    const total=p.mode==='focus'?25*60:5*60, C=2*Math.PI*55;
    ring.setAttribute('stroke-dashoffset', (C*(1-Math.max(0,Math.min(1,p.remaining/total)))).toFixed(1));
  }
}
function notifyDone(nextMode){
  const msg = nextMode==='break' ? 'Focus block done — take a 5-min break.' : 'Break over — back to focus.';
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('Your Daily Ritual', {body:msg, icon:'icon-180.png'});
      return;
    }
    if('Notification' in window && Notification.permission!=='denied'){
      Notification.requestPermission();
    }
  }catch(e){}
  // visual fallback only — alert can be jarring; skip
}

/* =====================================================
   WIRING / EVENT HANDLING
===================================================== */
function wire(){
  view.querySelectorAll('[data-act]').forEach(el=>{
    const act=el.dataset.act;
    if(el.tagName==='BUTTON'){el.onclick=()=>handle(act,el.dataset.id,el.dataset.val,el.dataset.iid);}
    else if(el.tagName==='SELECT'){el.onchange=()=>handle(act,el.dataset.id,el.value,el.dataset.iid);}
    else{el.oninput=()=>{updateField(act,el.dataset.id,el.value,el.dataset.iid);queueSave(saveBucket(act));};}
  });
}
function saveBucket(act){
  if(act.startsWith('r-')||act.startsWith('ri-'))return 'routines';
  if(act.startsWith('vg')||act.startsWith('mn')||act.startsWith('asp'))return 'vision';
  if(act.startsWith('asn')||act.startsWith('study')||act.startsWith('st')||act.startsWith('cls'))return 'school';
  if(act.startsWith('rev'))return 'reviews';
  if(act==='set-name'||act==='unit')return 'profile';
  return 'days';
}
function schedDay(){return getDay(tab==='plan'?planDate:todayKey());}

function applyRoutine(rid,dateKey){
  const r=state.routines.find(x=>x.id===rid); if(!r) return;
  const dd=getDay(dateKey);
  (r.items||[]).forEach(it=>{
    const dup=dd.schedule.find(s=>s.time===it.time&&s.text===it.text&&s.cat===it.cat);
    if(!dup) dd.schedule.push({id:uid(),time:it.time,text:it.text,cat:it.cat,done:false});
  });
  dd.schedule.sort((a,b)=>(a.time||'~').localeCompare(b.time||'~'));
}

function updateField(act,id,v,iid){
  const day=today();
  if(act==='intention') day.intention=v;
  else if(act==='journal') day.journal=v;
  else if(act==='sleep-hours') day.sleep.hours=v;
  else if(act==='weight') day.weight=v;
  else if(act==='goal-text'){const g=day.goals.find(x=>x.id===id);if(g)g.text=v;}
  else if(act==='sch-text'){const s=schedDay().schedule.find(x=>x.id===id);if(s)s.text=v;}
  else if(act==='sch-time'){const s=schedDay().schedule.find(x=>x.id===id);if(s)s.time=v;}
  else if(act==='vg-text'){const g=state.vision.goals.find(x=>x.id===id);if(g)g.text=v;}
  else if(act==='mn-text'){const g=state.vision.money.find(x=>x.id===id);if(g)g.text=v;}
  else if(act==='asn-text'){const a=state.school.assignments.find(x=>x.id===id);if(a)a.text=v;}
  else if(act==='r-name'){const r=state.routines.find(x=>x.id===id);if(r)r.name=v;}
  else if(act==='ri-time'){const r=state.routines.find(x=>x.id===id);if(r){const it=(r.items||[]).find(x=>x.id===iid);if(it)it.time=v;}}
  else if(act==='ri-text'){const r=state.routines.find(x=>x.id===id);if(r){const it=(r.items||[]).find(x=>x.id===iid);if(it)it.text=v;}}
  else if(act==='rev-well'||act==='rev-change'||act==='rev-next'){
    const wk=weekKey(todayKey());
    if(!state.reviews[wk]) state.reviews[wk]={wentWell:'',change:'',nextWeek:''};
    if(act==='rev-well') state.reviews[wk].wentWell=v;
    if(act==='rev-change') state.reviews[wk].change=v;
    if(act==='rev-next') state.reviews[wk].nextWeek=v;
  }
  else if(act==='set-name') state.profile.name=v;
}

function handle(act,id,v,iid){
  const day=today(),tk=todayKey();
  const D=()=>queueSave('days'), S=()=>queueSave('school'), V=()=>queueSave('vision'),
        H=()=>queueSave('habits'), R=()=>queueSave('routines'), P=()=>queueSave('profile'),
        PM=()=>queueSave('pomo');
  switch(act){
    /* today */
    case 'mood': day.mood=day.mood===v?'':v; D(); render(); break;
    case 'energy': day.energy=day.energy===v?'':v; D(); render(); break;
    case 'mood-core': moodCoreOpen = moodCoreOpen===v?null:v; render(); break;
    case 'feel-toggle':{
      const i=day.feelings.indexOf(v);
      if(i>=0) day.feelings.splice(i,1); else day.feelings.push(v);
      D(); render(); break;
    }
    case 'feel-del':{const i=day.feelings.indexOf(v);if(i>=0){day.feelings.splice(i,1);D();render();}break;}

    case 'goal-add':{const t=val('goalIn');if(t){day.goals.push({id:uid(),text:t,done:false});D();render();}break;}
    case 'goal-toggle':{const g=day.goals.find(x=>x.id===id);g.done=!g.done;D();render();break;}
    case 'goal-del': day.goals=day.goals.filter(x=>x.id!==id);D();render();break;
    case 'habit-toggle':{const h=state.habits.find(x=>x.id===id);h.completed[tk]?delete h.completed[tk]:h.completed[tk]=true;H();render();break;}

    /* schedule */
    case 'sch-add':{const sd=schedDay(),tm=val('schTime'),tx=val('schText');if(tx){sd.schedule.push({id:uid(),time:tm,text:tx,done:false,cat:(tab==='plan'?planCat:'event')});sd.schedule.sort((a,b)=>(a.time||'~').localeCompare(b.time||'~'));D();render();}break;}
    case 'sch-toggle':{const s=schedDay().schedule.find(x=>x.id===id);s.done=!s.done;D();render();break;}
    case 'sch-del':{const sd=schedDay();sd.schedule=sd.schedule.filter(x=>x.id!==id);D();render();break;}
    case 'plancat': planCat=v; render(); break;
    case 'plan-prev':{const d=new Date(planDate+'T00:00');d.setDate(d.getDate()-1);planDate=ymd(d);render();break;}
    case 'plan-next':{const d=new Date(planDate+'T00:00');d.setDate(d.getDate()+1);planDate=ymd(d);render();break;}
    case 'plan-today': planDate=todayKey(); render(); break;
    case 'plan-jump': planDate=v; planView='day'; render(); break;
    case 'view': planView=v; render(); break;
    case 'week-prev':{const d=new Date(planDate+'T00:00');d.setDate(d.getDate()-7);planDate=ymd(d);render();break;}
    case 'week-next':{const d=new Date(planDate+'T00:00');d.setDate(d.getDate()+7);planDate=ymd(d);render();break;}
    case 'month-prev':{const d=new Date(planDate+'T00:00');d.setMonth(d.getMonth()-1,1);planDate=ymd(d);render();break;}
    case 'month-next':{const d=new Date(planDate+'T00:00');d.setMonth(d.getMonth()+1,1);planDate=ymd(d);render();break;}

    /* routines */
    case 'r-add':{const n=val('rNew');if(n){state.routines.push({id:uid(),name:n,days:[],items:[]});R();render();}break;}
    case 'r-del': if(confirm('Delete this routine?')){state.routines=state.routines.filter(x=>x.id!==id);R();render();}break;
    case 'r-dow':{const r=state.routines.find(x=>x.id===id);if(!r)break;r.days=r.days||[];const n=+v,i=r.days.indexOf(n);i>=0?r.days.splice(i,1):r.days.push(n);R();render();break;}
    case 'ri-add':{const r=state.routines.find(x=>x.id===id);if(!r)break;const tm=(document.getElementById('rt_'+id)||{}).value||'',tx=((document.getElementById('rx_'+id)||{}).value||'').trim(),cc=(document.getElementById('rc_'+id)||{}).value||'event';if(tx){r.items=r.items||[];r.items.push({id:uid(),time:tm.trim(),text:tx,cat:cc});r.items.sort((a,b)=>(a.time||'~').localeCompare(b.time||'~'));R();render();}break;}
    case 'ri-del':{const r=state.routines.find(x=>x.id===id);if(r){r.items=(r.items||[]).filter(x=>x.id!==iid);R();render();}break;}
    case 'ri-cat':{const r=state.routines.find(x=>x.id===id);if(r){const it=(r.items||[]).find(x=>x.id===iid);if(it){it.cat=v;R();render();}}break;}
    case 'r-apply-today': applyRoutine(id,todayKey()); D(); render(); break;
    case 'r-apply-week':{const r=state.routines.find(x=>x.id===id);if(!r)break;if(!r.days||!r.days.length){alert('Pick which weekdays this routine runs on first (tap S M T W T F S).');break;}weekDaysOf(planDate).forEach((k,i)=>{if(r.days.includes(i))applyRoutine(id,k);});D();render();break;}
    case 'routine-apply-day':{const sel=document.getElementById('rApply');if(sel&&sel.value){applyRoutine(sel.value,planDate);D();render();}break;}

    /* body */
    case 'sleep-q': day.sleep.quality=day.sleep.quality===+v?0:+v;D();render();break;
    case 'water-plus': day.water++;D();render();break;
    case 'water-minus': day.water=Math.max(0,day.water-1);D();render();break;
    case 'protein-plus': day.protein++;D();render();break;
    case 'protein-minus': day.protein=Math.max(0,day.protein-1);D();render();break;
    case 'meal-add':{const t=val('mealIn');if(t){day.meals.push({id:uid(),text:t});D();render();}break;}
    case 'meal-del': day.meals=day.meals.filter(x=>x.id!==id);D();render();break;
    case 'wo-add':{const t=val('woType');if(t){day.workouts.push({id:uid(),type:t,mins:val('woMins'),note:val('woNote')});D();render();}break;}
    case 'wo-del': day.workouts=day.workouts.filter(x=>x.id!==id);D();render();break;
    case 'unit': state.profile.unit=v; P(); render(); break;

    /* mind */
    case 'read-plus': day.readMins+=5;D();render();break;
    case 'read-minus': day.readMins=Math.max(0,day.readMins-5);D();render();break;
    case 'meditate-plus': day.meditateMins+=5;D();render();break;
    case 'meditate-minus': day.meditateMins=Math.max(0,day.meditateMins-5);D();render();break;
    case 'learn-add':{const t=val('learnIn');if(t){day.learned.push({id:uid(),text:t});D();render();}break;}
    case 'learn-del': day.learned=day.learned.filter(x=>x.id!==id);D();render();break;
    case 'grat-add':{const t=val('gratIn');if(t){day.gratitude.push({id:uid(),text:t});D();render();}break;}
    case 'grat-del': day.gratitude=day.gratitude.filter(x=>x.id!==id);D();render();break;

    /* school */
    case 'cls-add':{const n=val('clsIn');if(n){const color=CLASS_PALETTE[state.school.classes.length%CLASS_PALETTE.length];state.school.classes.push({id:uid(),name:n,color});S();render();}break;}
    case 'cls-del': if(confirm('Delete this class? Assignments tagged to it will be untagged.')){state.school.classes=state.school.classes.filter(x=>x.id!==id);state.school.assignments.forEach(a=>{if(a.classId===id)a.classId='';});S();render();}break;
    case 'asn-add':{
      const t=val('asnText');
      if(t){
        const due=val('asnDue'), comp=val('asnComp')||due, cls=(document.getElementById('asnCls')||{}).value||'';
        state.school.assignments.push({id:uid(),text:t,classId:cls,due,completeBy:comp,done:false});
        S();render();
      }
      break;
    }
    case 'asn-toggle':{const a=state.school.assignments.find(x=>x.id===id);a.done=!a.done;S();render();break;}
    case 'asn-del': state.school.assignments=state.school.assignments.filter(x=>x.id!==id);S();render();break;
    case 'asn-schedule':{
      const a=state.school.assignments.find(x=>x.id===id);
      const date=a.completeBy||a.due||todayKey();
      const dd=getDay(date);
      dd.schedule.push({id:uid(),time:'',text:a.text,done:false,cat:'homework'});
      dd.schedule.sort((x,y)=>(x.time||'~').localeCompare(y.time||'~'));
      D();planDate=date;planCat='homework';planView='day';setTab('plan');break;
    }
    case 'study-add':{const sub=val('stSub'),m=val('stMin');if(sub){state.school.study.push({id:uid(),subject:sub,mins:m||'0',date:tk});S();render();}break;}
    case 'study-del': state.school.study=state.school.study.filter(x=>x.id!==id);S();render();break;

    /* vision */
    case 'vg-add':{const t=val('vgIn');if(t){state.vision.goals.push({id:uid(),text:t,done:false});V();render();}break;}
    case 'vg-toggle':{const g=state.vision.goals.find(x=>x.id===id);g.done=!g.done;V();render();break;}
    case 'vg-del': state.vision.goals=state.vision.goals.filter(x=>x.id!==id);V();render();break;
    case 'mn-add':{const t=val('mnIn');if(t){state.vision.money.push({id:uid(),text:t,done:false});V();render();}break;}
    case 'mn-toggle':{const g=state.vision.money.find(x=>x.id===id);g.done=!g.done;V();render();break;}
    case 'mn-del': state.vision.money=state.vision.money.filter(x=>x.id!==id);V();render();break;
    case 'asp-add':{const t=val('aspIn');if(t){state.vision.aspirations.push({id:uid(),text:t});V();render();}break;}
    case 'asp-del': state.vision.aspirations=state.vision.aspirations.filter(x=>x.id!==id);V();render();break;
    case 'habit-add':{const t=val('habitIn');if(t){state.habits.push({id:uid(),name:t,completed:{}});H();render();}break;}
    case 'habit-del': if(confirm('Delete this habit and its streak history?')){state.habits=state.habits.filter(x=>x.id!==id);H();render();}break;

    /* settings */
    case 'toggle-theme': toggleTheme(); break;
    case 'export': exportData(); break;
    case 'import': document.getElementById('importFile').click(); break;
    case 'wipe': if(confirm('This deletes ALL your data on this device. Be sure you exported a backup first. Continue?')){wipeData();}break;

    /* pomodoro */
    case 'pomo-start':{
      const p=state.pomo;
      p.endTime = Date.now() + p.remaining*1000;
      p.running = true;
      PM();
      try{ if('Notification' in window && Notification.permission==='default') Notification.requestPermission(); }catch(e){}
      render();
      break;
    }
    case 'pomo-pause':{
      const p=state.pomo;
      p.remaining = Math.max(0, Math.floor((p.endTime-Date.now())/1000));
      p.running=false; p.endTime=null;
      PM(); render(); break;
    }
    case 'pomo-reset':{
      const p=state.pomo;
      p.remaining = p.mode==='focus'?25*60:5*60;
      p.running=false; p.endTime=null;
      PM(); render(); break;
    }
    case 'pomo-skip':{
      const p=state.pomo;
      p.mode = p.mode==='focus'?'break':'focus';
      p.remaining = p.mode==='focus'?25*60:5*60;
      p.running=false; p.endTime=null;
      PM(); render(); break;
    }
  }
}

/* ---------- enter to add ---------- */
view.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.target.tagName==='TEXTAREA')return;
  const id=e.target.id;
  const map={goalIn:'goal-add',schText:'sch-add',mealIn:'meal-add',woType:'wo-add',woNote:'wo-add',
    learnIn:'learn-add',gratIn:'grat-add',asnText:'asn-add',stSub:'study-add',stMin:'study-add',
    vgIn:'vg-add',mnIn:'mn-add',aspIn:'asp-add',habitIn:'habit-add',rNew:'r-add',clsIn:'cls-add'};
  if(map[id]){e.preventDefault();handle(map[id]);return;}
  if(id && (id.startsWith('rx_')||id.startsWith('rt_'))){e.preventDefault();handle('ri-add',e.target.dataset.rid);}
});

/* ---------- backup ---------- */
function exportData(){
  const payload={
    profile:state.profile, habits:state.habits, days:state.days,
    school:state.school, vision:state.vision, routines:state.routines,
    reviews:state.reviews, pomo:state.pomo
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='ydr-backup-'+todayKey()+'.json'; a.click();
}
document.getElementById('importFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(d.profile)Object.assign(state.profile,d.profile);
      if(d.habits)state.habits=d.habits;
      if(d.days)state.days=d.days;
      if(d.school)state.school=Object.assign({classes:[],assignments:[],study:[]},d.school);
      if(d.vision)Object.assign(state.vision,d.vision);
      if(d.routines)state.routines=d.routines;
      if(d.reviews)state.reviews=d.reviews;
      if(d.pomo)Object.assign(state.pomo,d.pomo);
      ['profile','habits','days','school','vision','routines','reviews','pomo'].forEach(queueSave);
      flush(); applyTheme(); renderHeader(); render();
      alert('Backup restored.');
    }catch(err){alert('That file could not be read.');}
  };
  r.readAsText(f);
});
function wipeData(){
  ['profile','habits','days','school','vision','routines','reviews','pomo'].forEach(k=>{
    try{ localStorage.removeItem(K[k]); }catch(e){}
  });
  location.reload();
}

/* ---------- init ---------- */
load();
