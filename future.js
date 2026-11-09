
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const plus=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const read=()=>{try{const a=JSON.parse(localStorage.getItem('reptrack-workouts-v1')||'[]');return Array.isArray(a)?a.filter(e=>e&&typeof e.date==='string'&&Array.isArray(e.sets)):[]}catch{return []}};
const weights=e=>e.sets.filter(s=>Number.isFinite(+s.weight)&&Number.isFinite(+s.reps)&&+s.weight>=0&&+s.reps>0);
const volume=e=>weights(e).reduce((n,s)=>n+(+s.weight)*(+s.reps),0);
const e1rm=s=>+s.weight*(1+Math.min(12,+s.reps)/30);
const rounded=n=>Math.round(n).toLocaleString();
const node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const $=s=>document.querySelector(s);
const recoveryVal=()=>{const val=el('recoveryMetric')?.textContent?.trim();return val&&val.endsWith('%')&&Number.isFinite(parseFloat(val))?parseFloat(val):null};
const tone=r=>r==null?'neutral':r>=67?'green':r>=34?'yellow':'red';
const dateSelected=()=>{const tile=$('.day.selected');const str=tile?.dataset.date;return str&&/^\d{4}-\d\d-\d\d$/.test(str)?str:iso(new Date())};
const planName=()=>el('dayWorkout')?.textContent||'TRAIN';
const defaultModel=()=>{try{return localStorage.getItem('reptrack-model-v2')||'auto'}catch{return'auto'}};
let model=['auto','strength','hypertrophy','recovery'].includes(defaultModel())?defaultModel():'auto';
let graphMode='volume',lastSynced=null,calendarMode='month';
function makeHero(){
const calendar=$('[data-page="calendar"]');if(!calendar)return;
const hero=node('div','hero-future fade-up');
hero.innerHTML='<div class="hero-left"><span class="future-pill"><span class="live-indicator"></span> TODAY’S TRAINING / LIVE</span><div id="heroToday" class="hero-day">TODAY</div><h1 id="heroWorkout">YOUR WORKOUT</h1><p id="heroFocus">Your training schedule at a glance. Tap a calendar day to log exercises.</p><div class="hero-cta"><button id="heroOpenToday" class="btn-primary" type="button">OPEN TODAY’S WORKOUT ↗</button><span class="micro">OR SELECT ANY CALENDAR DAY</span></div><div class="hero-strip"><span class="hero-meta">CYCLE <strong>7-DAY ROTATION</strong></span><span class="hero-meta">DATA <strong id="heroData">SYNCING</strong></span><span class="hero-meta">MODE <strong id="heroMode">ADAPTIVE</strong></span></div></div><div class="hero-orbit" aria-hidden="true"><span class="orbit-point"></span><div class="orbit-core"><strong id="orbitValue">—</strong><small>RECOVERY</small></div></div>';
const head=calendar.querySelector('.page-head');head?.after(hero);
 el('heroOpenToday')?.addEventListener('click',()=>{el('todayButton')?.click();const today=iso(new Date());const tile=Array.from(el('monthGrid')?.querySelectorAll('.day')||[]).find(e=>e.dataset.date===today);tile?.click()});
}
function makeAdaptive(){
const calendar=$('[data-page="calendar"]');if(!calendar)return;
const section=node('div','future-grid fade-up');section.id='futureModels';
section.innerHTML='<div class="section"><div class="section-title"><div><div class="micro">01 / INTELLIGENCE ENGINE</div><h2>ADAPTIVE ACTION PLAN</h2></div><span class="future-pill" id="modelBadge">RULE-BASED MODEL</span></div><p class="future-blurb">Select a training model. RepTrack factors in your WHOOP recovery, planned session and workout history to suggest a practical intensity—not an automated medical assessment.</p><div class="future-model-switch" id="modelSwitch"><button data-model="auto">ADAPTIVE</button><button data-model="strength">STRENGTH</button><button data-model="hypertrophy">HYPERTROPHY</button><button data-model="recovery">RECOVERY</button></div><div class="future-value" id="actionTitle">—</div><div class="future-blurb" id="actionDescription"></div><div id="actionRows" style="margin-top:18px"></div><button id="actionLog" class="btn-primary" style="margin-top:17px">BEGIN SELECTED SESSION ↗</button></div><div class="section"><div class="section-title"><div><div class="micro">02 / LIVE PHYSIOLOGY</div><h2>READINESS INTERPRETATION</h2></div><span class="live-time" id="lastSync">LIVE · CHECKING</span></div><div class="energy-shell"><div><span class="micro">WHOOP RECOVERY</span><div class="future-value" id="energyValue" style="margin:8px 0 5px">—</div><div id="energyLabel" class="future-pill">NO SCORE</div></div><div class="energy-ring" id="energyRing"><span id="energyRingText">—</span></div></div><div class="insight" style="margin:22px 0 12px"><strong>INTERPRETATION</strong><span id="energyNarrative">Waiting for WHOOP recovery data.</span></div><div class="future-recommendation"><span class="model-label">PLANNED FOCUS</span><span class="val" id="plannedFocus">—</span></div><div class="future-recommendation"><span class="model-label">TRAINING TODAY</span><span class="val" id="trainingToday">—</span></div></div>';
const grid=calendar.querySelector('.intel-grid');grid?.after(section);
const trend=node('div','future-grid fade-up');
trend.innerHTML='<div class="section"><div class="section-title"><div><div class="micro">03 / PERFORMANCE SIGNAL</div><h2>TRAINING TELEMETRY</h2></div><div class="trend-tabs" id="trendTabs"><button data-trend="volume" class="active">VOLUME</button><button data-trend="strength">STRENGTH</button><button data-trend="sets">SETS</button></div></div><div id="signalGraph"></div><div id="signalDescription" class="muted" style="margin-top:12px;font-size:11px"></div></div><div class="section"><div class="section-title"><div><div class="micro">04 / CONSISTENCY MATRIX</div><h2>TRAINING LOAD MAP</h2></div><span class="future-pill">56 DAYS</span></div><div class="load-heatmap" id="loadHeatmap"></div><div class="future-recommendation" style="margin-top:20px"><span class="model-label">ACTIVE DAYS / 56</span><span class="val" id="activeDays">0</span></div><div class="future-recommendation"><span class="model-label">TOTAL LOAD / 56</span><span class="val" id="loadTotal">0</span></div><div class="future-recommendation"><span class="model-label">LOGGED SETS / 56</span><span class="val" id="loadSets">0</span></div></div>';
const main=calendar.querySelector('.main-split');main?.after(trend);
const controls=calendar.querySelector('.calendar-controls');if(controls){
const btn=node('button','smallbtn btn-ghost','FOCUS WEEK');btn.id='calendarView';btn.type='button';controls.prepend(btn);
btn.addEventListener('click',()=>{calendarMode=calendarMode==='month'?'week':'month';btn.textContent=calendarMode==='month'?'FOCUS WEEK':'FULL MONTH';showCalendarMode()});
}
for(const b of document.querySelectorAll('[data-model]'))b.addEventListener('click',()=>{model=b.dataset.model;try{localStorage.setItem('reptrack-model-v2',model)}catch{}updatePanels()});
for(const b of document.querySelectorAll('[data-trend]'))b.addEventListener('click',()=>{graphMode=b.dataset.trend;renderSignal()});
el('actionLog')?.addEventListener('click',()=>el('dayStart')?.click());
}
function recommended(){
const r=recoveryVal(),name=planName(),isLegs=name==='LEGS';
const recent=read().filter(e=>e.date>=iso(plus(new Date(),-6))),weekSets=recent.reduce((n,e)=>n+weights(e).length,0);
const low=r!=null&&r<34,mid=r!=null&&r<67&&!low;
const base=model==='auto'?(low?'recovery':mid?'hypertrophy':'strength'):model;
const targets={strength:{label:'PROGRESSIVE LOAD',sets:isLegs?'12–17':'14–19',intensity:'RPE 7–8',rest:'2–3 MIN'},hypertrophy:{label:'CONTROLLED VOLUME',sets:'13–18',intensity:'RPE 6–8',rest:'90–150 SEC'},recovery:{label:'REDUCED LOAD',sets:'6–10',intensity:'RPE 5–6',rest:'AS NEEDED'}}[base];
const caution=low?'Low recovery detected: consider rest or lower effort.':mid?'Moderate recovery: leave reps in reserve.':r==null?'No recovery score: use your energy and technique to guide effort.':'High recovery: follow your planned intensity if you feel good.';
return{...targets,base,r,name,weekSets,caution};
}
function updateTodayHero(){
 const today=new Date(),day=today.getDay(),stamp=iso(today);
 const planned=typeof window.RepTrackPlanForDate==='function'?window.RepTrackPlanForDate(stamp):null;
 const name=planned?.title||['LEGS','PUSH','PULL','LEGS','CHEST','BACK','SHOULDERS + ARMS'][day];
 const focus=planned?.focus||['Lower body · posterior','Chest · Shoulders · Triceps','Back · Biceps','Lower body · quad','Chest','Back','Shoulders · Biceps · Triceps'][day];
 if(el('heroToday'))el('heroToday').textContent=today.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
 if(el('heroWorkout'))el('heroWorkout').textContent=name+' DAY';
 if(el('heroFocus'))el('heroFocus').textContent=focus+'  ·  Select a date in the calendar to open your workout and log sets.';
}
function updatePanels(){
if(!el('actionTitle'))return;
const rec=recommended(),r=rec.r,modeName=model==='auto'?'ADAPTIVE':model.toUpperCase();
document.querySelectorAll('[data-model]').forEach(b=>b.classList.toggle('active',b.dataset.model===model));
el('heroMode').textContent=modeName;el('actionTitle').textContent=rec.label;
el('actionDescription').textContent=rec.name+' — '+rec.caution;
const rows=[['TODAY’S TARGET SETS',rec.sets],['SUGGESTED EFFORT',rec.intensity],['BETWEEN-SET REST',rec.rest],['LAST 7 DAYS',rec.weekSets+' SETS']];
el('actionRows').replaceChildren();
rows.forEach(([title,val])=>{const wrap=node('div','future-recommendation');wrap.append(node('span','model-label',title),node('span','val',val));el('actionRows').append(wrap)});
el('plannedFocus').textContent=rec.name;el('trainingToday').textContent=rec.label;
const val=r==null?'—':r+'%';
el('energyValue').textContent=val;el('energyRingText').textContent=val;el('orbitValue').textContent=val;el('energyLabel').textContent=r==null?'NO SCORE':r>=67?'HIGH RECOVERY':r>=34?'MODERATE RECOVERY':'LOW RECOVERY';
const tones={green:'#38e28a',yellow:'#ffcc53',red:'#ff586a',neutral:'#a1a8b6'};
const color=tones[tone(r)];
el('energyValue').style.color=color;el('orbitValue').style.color=color;el('energyRing').style.setProperty('--ring-color',color);el('energyRing').style.setProperty('--ring-percent',r==null?'0%':r+'%');
el('energyNarrative').textContent=r==null?'No WHOOP recovery score is available yet. Your scheduled workout remains accessible.':rec.caution+' Use sleep, fatigue, form, and personal judgment alongside wearable data.';
el('heroData').textContent=el('whoopBadge')?.textContent?.includes('CONNECTED')?'WHOOP LIVE':'LOCAL ONLY';
if(lastSynced)el('lastSync').textContent='SYNCED '+lastSynced.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
}
function svgChart(values){
const width=760,height=190,left=8,right=752,top=20,bottom=169;
const max=Math.max(1,...values.map(x=>x.y));const y=v=>bottom-(v/max)*(bottom-top);
const coords=values.map((v,i)=>[left+(right-left)*(i/Math.max(1,values.length-1)),y(v.y)]);
const paths=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
const area=paths+' L '+right+' '+bottom+' L '+left+' '+bottom+' Z';
const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 760 190');svg.setAttribute('class','signal-graph');svg.setAttribute('role','img');svg.setAttribute('aria-label','Performance trend for '+graphMode);
const defs=document.createElementNS(ns,'defs');const grad=document.createElementNS(ns,'linearGradient');grad.setAttribute('id','signalFill');grad.setAttribute('x1','0');grad.setAttribute('y1','0');grad.setAttribute('x2','0');grad.setAttribute('y2','1');[[0,.22],[1,0]].forEach(([off,alpha])=>{const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',(off*100)+'%');stop.setAttribute('stop-color','#fff');stop.setAttribute('stop-opacity',alpha);grad.append(stop)});defs.append(grad);svg.append(defs);
[0,.5,1].forEach(t=>{const line=document.createElementNS(ns,'line');line.setAttribute('x1','0');line.setAttribute('x2','760');line.setAttribute('y1',top+(bottom-top)*t);line.setAttribute('y2',top+(bottom-top)*t);line.setAttribute('class','gridline');svg.append(line)});
const path=(d,cls)=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('class',cls);svg.append(p);return p};path(area,'area');const main=path(paths,'line');
if(main.getTotalLength){try{const len=main.getTotalLength();main.style.strokeDasharray=len;main.style.strokeDashoffset=len;main.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:1100,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'})}catch{}}
coords.forEach((p,i)=>{if(values[i].y<=0)return;const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);c.setAttribute('r','3.4');c.setAttribute('class','point');const title=document.createElementNS(ns,'title');title.textContent=values[i].label+' · '+rounded(values[i].y);c.append(title);svg.append(c)});
return svg;
}
function renderSignal(){
const target=el('signalGraph');if(!target)return;
document.querySelectorAll('[data-trend]').forEach(b=>b.classList.toggle('active',b.dataset.trend===graphMode));
const entries=read(),now=new Date(),dates=Array.from({length:21},(_,i)=>iso(plus(now,i-20)));
const values=dates.map(date=>{const day=entries.filter(e=>e.date===date);let val=graphMode==='volume'?day.reduce((n,e)=>n+volume(e),0):graphMode==='sets'?day.reduce((n,e)=>n+weights(e).length,0):Math.max(0,...day.flatMap(weights).map(e1rm));return{label:date,y:val}});
target.replaceChildren(svgChart(values));
const total=values.reduce((n,v)=>n+v.y,0);const top=Math.max(0,...values.map(v=>v.y));
el('signalDescription').textContent=graphMode==='volume'?'21-day volume · '+rounded(total)+' lb-reps logged':graphMode==='strength'?'Top estimated 1RM across exercises · '+rounded(top)+' lbs (not a tested max)':'21-day working sets · '+rounded(total)+' sets';
}
function renderHeat(){
const h=el('loadHeatmap');if(!h)return;
const now=new Date(),logs=read(),days=Array.from({length:56},(_,i)=>iso(plus(now,i-55)));
let active=0,total=0,setCount=0;h.replaceChildren();
const levels=days.map(date=>{const matching=logs.filter(e=>e.date===date);const v=matching.reduce((n,e)=>n+volume(e),0),sets=matching.reduce((n,e)=>n+weights(e).length,0);if(matching.length)active++;total+=v;setCount+=sets;return{date,v,sets}});
const top=Math.max(1,...levels.map(x=>x.v));
levels.forEach(x=>{const cell=node('div','heat-day');cell.dataset.level=x.v===0?'0':String(Math.max(1,Math.min(4,Math.ceil(x.v/top*4))));cell.title=x.date+' · '+rounded(x.v)+' lb-reps · '+x.sets+' sets';h.append(cell)});
el('activeDays').textContent=active;el('loadTotal').textContent=rounded(total);el('loadSets').textContent=rounded(setCount);
}
function showCalendarMode(){
const grid=el('monthGrid');if(!grid)return;
const selection=dateSelected();const selectedDate=new Date(selection+'T12:00:00'),monday=plus(selectedDate,-((selectedDate.getDay()+6)%7)),end=plus(monday,6);
grid.querySelectorAll('.day').forEach(b=>{const d=b.dataset.date; b.classList.toggle('hidden',calendarMode==='week'&&(d<iso(monday)||d>iso(end)))});
const label=el('monthLabel');
if(label&&calendarMode==='week')label.textContent=monday.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' – '+end.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function addRecoveryMarker(){
const today=iso(new Date()),r=recoveryVal(),tile=Array.from(document.querySelectorAll('.day')).find(d=>d.dataset.date===today);
document.querySelectorAll('.day .recovery-dot').forEach(x=>x.remove());
if(tile&&r!=null){const dot=node('span','recovery-dot');dot.style.background=r>=67?'#38e28a':r>=34?'#ffcc53':'#ff586a';dot.title='Today WHOOP recovery '+r+'%';tile.append(dot)}
}
function refresh(){
updateTodayHero();updatePanels();renderSignal();renderHeat();addRecoveryMarker();if(calendarMode==='week')showCalendarMode();
}
function watch(){
const calendar=el('monthGrid');if(calendar){const obs=new MutationObserver((changes)=>{if(changes.some(c=>c.target===calendar)){if(calendarMode==='week')showCalendarMode();addRecoveryMarker()}});obs.observe(calendar,{childList:true})}
const metric=el('recoveryMetric');if(metric){const ob=new MutationObserver(()=>{lastSynced=new Date();updatePanels();addRecoveryMarker()});ob.observe(metric,{childList:true,characterData:true,subtree:true})}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',refresh));
el('logForm')?.addEventListener('submit',()=>setTimeout(refresh,80));
el('restoreInput')?.addEventListener('change',()=>setTimeout(refresh,600));
window.addEventListener('storage',e=>{if(e.key==='reptrack-workouts-v1'||e.key==='reptrack-day-plans-v1'||e.key==='reptrack-weekday-plans-v1')refresh()});
window.addEventListener('reptrack-plan-changed',refresh);
document.querySelectorAll('.day').forEach(b=>b.addEventListener('click',refresh));
el('monthGrid')?.addEventListener('click',e=>{if(e.target.closest('.day'))setTimeout(refresh,20)});
// WHOOP updates automatically; the recovery metric observer refreshes this view.
const toggled=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!toggled){document.querySelectorAll('.intel-card').forEach(card=>{card.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;card.style.transform='perspective(900px) rotateY('+((x-.5)*5)+'deg) rotateX('+((.5-y)*5)+'deg) translateY(-3px)'});card.addEventListener('pointerleave',()=>card.style.transform='')})}
}
makeHero();makeAdaptive();watch();refresh();
})();
