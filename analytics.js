
(()=>{'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',KEY='reptrack-workouts-v1';
let range=30,volumeMode='volume',strengthMode='estimate';
const pad=n=>String(n).padStart(2,'0'),iso=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const plus=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n),fmt=n=>Math.round(n).toLocaleString('en-US');
const get=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(e=>e&&typeof e.date==='string'&&typeof e.exercise==='string'&&Array.isArray(e.sets)):[]}catch{return []}};
const sets=e=>e.sets.filter(s=>Number.isFinite(+s.weight)&&+s.weight>=0&&Number.isFinite(+s.reps)&&+s.reps>0),vol=e=>sets(e).reduce((n,s)=>n+ +s.weight* +s.reps,0),max=s=>+s.weight*(1+Math.min(12,+s.reps)/30);
const dom=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
const svgEl=(tag,attrs={},content)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(content!==undefined)e.textContent=content;return e};
const plot=()=>svgEl('svg',{viewBox:'0 0 820 250',class:'analytics-svg',role:'img'});
function empty(host,content='Log workouts to unlock this chart.'){host.replaceChildren(dom('div','chart-empty',content))}
function line(host,points,unit=''){
if(!points.length||!points.some(p=>p.value>0))return empty(host);
const svg=plot(),left=49,right=805,top=18,bottom=211,maxValue=Math.max(1,...points.map(p=>p.value)),ceil=maxValue*1.12;
const x=i=>left+(right-left)*i/Math.max(1,points.length-1),y=v=>bottom-v/ceil*(bottom-top);
for(let i=0;i<=4;i++){const yy=bottom-i*(bottom-top)/4;svg.append(svgEl('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#333b4a','stroke-width':1,'stroke-dasharray':'4 7'}));svg.append(svgEl('text',{x:42,y:yy+4,'text-anchor':'end',class:'svg-label'},fmt(i*ceil/4)))}
const d=points.map((p,i)=>(i?'L':'M')+x(i).toFixed(2)+','+y(p.value).toFixed(2)).join(' ');
const area=d+' L'+right+','+bottom+' L'+left+','+bottom+' Z',id='grad-'+host.id;
const defs=svgEl('defs'),gradient=svgEl('linearGradient',{id,x1:'0',y1:'0',x2:'0',y2:'1'});
gradient.append(svgEl('stop',{offset:'0%','stop-color':'#e7edf7','stop-opacity':'.22'}),svgEl('stop',{offset:'100%','stop-color':'#e7edf7','stop-opacity':'0'}));defs.append(gradient);svg.append(defs);
svg.append(svgEl('path',{d:area,fill:'url(#'+id+')'}));
const path=svgEl('path',{d,fill:'none',stroke:'#f7f9fc','stroke-width':2.7,'stroke-linejoin':'round','stroke-linecap':'round'});svg.append(path);
points.forEach((p,i)=>{if(p.value===0&&points.length>14)return;const c=svgEl('circle',{cx:x(i),cy:y(p.value),r:points.length>25?2.2:3.4,fill:'#e9edf5',stroke:'#10131a','stroke-width':1.5});c.append(svgEl('title',{},p.label+' · '+fmt(p.value)+' '+unit));svg.append(c)});
const step=Math.max(1,Math.ceil(points.length/6));points.forEach((p,i)=>{if(i%step===0||i===points.length-1)svg.append(svgEl('text',{x:x(i),y:237,'text-anchor':'middle',class:'svg-label'},p.short||p.label.slice(5)))});
host.replaceChildren(svg);
}
function bars(host,points,unit=''){
if(!points.length||!points.some(x=>x.value>0))return empty(host);
const svg=plot(),l=42,r=811,top=18,bottom=211,peak=Math.max(1,...points.map(p=>p.value))*1.13,gap=(r-l)/points.length;
for(let i=0;i<=4;i++){const yy=bottom-(bottom-top)*i/4;svg.append(svgEl('line',{x1:l,y1:yy,x2:r,y2:yy,stroke:'#303746','stroke-dasharray':'4 7'}))}
points.forEach((p,i)=>{const h=p.value/peak*(bottom-top),width=Math.max(3,gap*.59),x=l+i*gap+(gap-width)/2;const b=svgEl('rect',{x,y:bottom-h,width,height:Math.max(h,1),rx:3,fill:i===points.length-1?'#f5f7fa':'#9ca6b7'});b.append(svgEl('title',{},p.label+' · '+fmt(p.value)+' '+unit));svg.append(b);
if(points.length<=14||i%Math.max(1,Math.ceil(points.length/7))===0)svg.append(svgEl('text',{x:x+width/2,y:234,'text-anchor':'middle',class:'svg-label'},p.short||p.label.slice(5)))});
host.replaceChildren(svg);
}
function donut(host,counts){
host.replaceChildren();
const rows=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,7),total=rows.reduce((a,b)=>a+b[1],0);
if(!total)return empty(host);
const flex=dom('div','donut-layout'),ring=dom('div','donut-ring'),center=dom('div','donut-center'),list=dom('div','donut-legend');
center.append(dom('strong','',fmt(total)),dom('span','','SETS'));ring.append(center);
let angle=0;const grays=['#f8fafc','#d7dee9','#a8b3c5','#7d8799','#555e6e','#3f4755','#2b323e'],stops=[];
rows.forEach(([name,n],i)=>{const end=angle+n/total*100;stops.push(grays[i]+' '+angle+'% '+end+'%');angle=end;const r=dom('div','legend-item');const label=dom('div');label.append(dom('span','legend-dot'));label.lastChild.style.background=grays[i];label.append(dom('span','',name));r.append(label,dom('strong','',n+' sets'));list.append(r)});
ring.style.background='conic-gradient('+stops.join(',')+')';flex.append(ring,list);host.append(flex);
}
const entriesInRange=()=>{const today=new Date(),cut=iso(plus(today,-range+1));return get().filter(e=>e.date>=cut&&e.date<=iso(today))};
function summary(){
const entries=entriesInRange(),volume=entries.reduce((n,e)=>n+vol(e),0),done=new Set(entries.map(e=>e.date)).size,setCount=entries.reduce((n,e)=>n+sets(e).length,0);
$('analysisVolume').textContent=fmt(volume);$('analysisSessions').textContent=fmt(done);$('analysisSets').textContent=fmt(setCount);
const now=new Date(),beforeStart=iso(plus(now,-range*2+1)),beforeEnd=iso(plus(now,-range)),prev=get().filter(e=>e.date>=beforeStart&&e.date<=beforeEnd).reduce((n,e)=>n+vol(e),0);
$('analysisChange').textContent=prev?((volume-prev)/prev>=0?'+':'')+Math.round((volume-prev)/prev*100)+'%':'—';
$('analysisVolumeNote').textContent=volumeMode==='volume'?'Weight × reps summed across your logged exercises.':'Working sets logged per day.';
const grouped=new Map();entries.forEach(e=>grouped.set(e.date,(grouped.get(e.date)||0)+(volumeMode==='volume'?vol(e):sets(e).length)));
const points=Array.from({length:range},(_,i)=>{const date=iso(plus(now,i-range+1));return{label:date,value:grouped.get(date)||0}});
line($('analysisVolumeChart'),points,volumeMode==='volume'?'lb-reps':'sets');
const weekly=[],start=plus(now,-range+1),startMonday=plus(start,-((start.getDay()+6)%7));
for(let d=new Date(startMonday),i=0;d<=now&&i<30;d=plus(d,7),i++){
const end=iso(plus(d,6)),begin=iso(d),setTotal=entries.filter(e=>e.date>=begin&&e.date<=end).reduce((n,e)=>n+sets(e).length,0);
weekly.push({label:begin,short:d.toLocaleDateString(undefined,{month:'numeric',day:'numeric'}),value:setTotal});
}
bars($('analysisWeeklySets'),weekly,'sets');
const allDays=[...new Set(entries.map(e=>e.date))].sort(),sessions=allDays.slice(-18).map(date=>({label:date,value:entries.filter(e=>e.date===date).reduce((n,e)=>n+vol(e),0)}));
bars($('analysisSessionsChart'),sessions,'lb-reps');
const counts=new Map();entries.forEach(e=>counts.set(e.exercise,(counts.get(e.exercise)||0)+sets(e).length));donut($('analysisDistribution'),counts);
}
function getExerciseRows(ex){return get().filter(e=>e.exercise===ex).sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0))}
function metricFor(e,m){const ss=sets(e);return m==='volume'?vol(e):m==='weight'?Math.max(0,...ss.map(s=>+s.weight)):m==='reps'?Math.max(0,...ss.map(s=>+s.weight))?Math.max(...ss.filter(s=>+s.weight===Math.max(0,...ss.map(t=>+t.weight))).map(s=>+s.reps)):0:Math.max(0,...ss.map(max))}
function strength(){
const ex=$('exerciseSelect').value,rows=getExerciseRows(ex).filter(e=>e.date>=iso(plus(new Date(),-range+1)));
const values=rows.map(e=>({label:e.date,short:e.date.slice(5),value:metricFor(e,strengthMode)}));
line($('strengthChart'),values,strengthMode==='volume'?'lb-reps':'lbs');
$('analysisStrengthNote').textContent=values.length?'Latest: '+fmt(values.at(-1).value)+' · Best: '+fmt(Math.max(...values.map(x=>x.value)))+(strengthMode==='estimate'?' lbs (Epley estimate)':''):'Log '+ex+' to see progression.';
}
function overload(){
const ex=$('overloadExercise').value,all=getExerciseRows(ex).filter(e=>sets(e).some(s=>+s.weight>0)),metric=$('overloadMetric').value;
const filtered=all.filter(e=>e.date>=iso(plus(new Date(),-range+1)));
line($('overloadChart'),filtered.map(e=>({label:e.date,value:metricFor(e,metric)})),metric==='volume'?'lb-reps':metric==='reps'?'reps':'lbs');
const last=all.at(-1),prev=all.length>1?all.at(-2):null,lastSet=last?sets(last).filter(s=>+s.weight>0).sort((a,b)=>+b.weight-+a.weight||+b.reps-+a.reps)[0]:null;
$('overloadLast').textContent=lastSet?lastSet.weight+' × '+lastSet.reps:'—';
$('overloadPR').textContent=all.length?fmt(Math.max(...all.flatMap(e=>sets(e).map(s=>+s.weight))))+' LB':'—';
const latestValue=last?metricFor(last,metric):0,previousValue=prev?metricFor(prev,metric):0,diff=latestValue-previousValue;
$('overloadDelta').textContent=prev?(diff>0?'+':'')+Number(diff.toFixed(1))+(metric==='reps'?' REPS':metric==='volume'?' LB-REPS':' LB'):'—';
const bestWeight=lastSet?+lastSet.weight:0,bestReps=lastSet?+lastSet.reps:0;
const next=lastSet?(bestReps>=10?'TRY '+fmt(bestWeight+5)+' LB':'TRY '+fmt(bestWeight)+' LB × '+(bestReps+1)):'LOG A SET';
$('overloadNext').textContent=next;
$('overloadNote').textContent=lastSet?'Optional example target based on your last heaviest set; adjust for recovery, form and exercise. No increase is required.':'Log sets with weights and reps to generate overload insights.';
const list=$('overloadSessionList');list.replaceChildren();all.slice(-6).reverse().forEach(e=>{const row=dom('div','overload-row'),summary=dom('div');summary.append(dom('strong','',e.date),dom('small','',sets(e).map(s=>s.weight+'×'+s.reps).join(' · ')));row.append(summary,dom('strong','',fmt(metricFor(e,metric))));list.append(row)});
}

function renderSquatMonth(){
 const target=$('squatMonthRows'),chart=$('squatPlanChart');
 if(!target||!chart)return;
 const entries=get(),plan=[];
 for(let i=0;i<30;i++){
  const day=new Date(2026,10,9+i),date=iso(day),prescription=window.RepTrackDailySquatTarget?.(date);
  if(prescription)plan.push({date,weight:prescription.weight,reps:prescription.reps,day:i+1,reported:prescription.reported});
 }
 target.replaceChildren();chart.replaceChildren();
 if(!plan.length)return;
 const svg=svgEl('svg',{viewBox:'0 0 770 220',class:'analytics-svg',role:'img','aria-label':'30-day daily back squat working weight targets'});
 const x=i=>55+i*680/29,y=w=>172-(w-100)*.6;
 [125,175,225,275].forEach(v=>{
  svg.append(svgEl('line',{x1:48,y1:y(v),x2:745,y2:y(v),stroke:'#ffffff25','stroke-dasharray':'4 6'}));
  svg.append(svgEl('text',{x:42,y:y(v)+4,'text-anchor':'end',class:'svg-label'},v+' lb'));
 });
 svg.append(svgEl('path',{d:plan.map((p,i)=>(i?'L':'M')+x(i)+','+y(p.weight)).join(' '),stroke:'#f7f9fd','stroke-width':2.8,fill:'none'}));
 plan.forEach((p,i)=>{
  const circle=svgEl('circle',{cx:x(i),cy:y(p.weight),r:i<2?5:3.5,fill:i<2?'#c0c9d8':'#f7f9fd'});
  circle.append(svgEl('title',{},p.date+' · 2 × '+p.weight+' lb × '+p.reps+' reps'+(p.reported?' · reported':' · target')));
  svg.append(circle);
 });
 [0,6,13,20,29].forEach(i=>svg.append(svgEl('text',{x:x(i),y:208,'text-anchor':'middle',class:'svg-label'},'DAY '+(i+1))));
 chart.append(svg);
 const legend=dom('div','squat-legend');
 legend.append(dom('span','', 'Nov 9–10 · user-reported benchmarks'),dom('span','', 'Rest · scheduled training targets'));
 chart.append(legend);
 const today=iso(new Date());
 for(const p of plan){
  const logged=entries.filter(e=>e.date===p.date&&/^Back Squat$/i.test(e.exercise));
  const working=logged.flatMap(e=>sets(e).filter(v=>!v.warmup));
  const tr=dom('tr');
  tr.append(dom('td','',String(p.day)),dom('td','',p.date));
  const cell=dom('td'),button=dom('button','plan-link','2 × '+p.weight+' lb × '+p.reps+' reps');
  button.onclick=()=>goToSquatDay(p.date);
  cell.append(button);tr.append(cell);
  tr.append(dom('td','',working.length?'✓ '+working.length+' WORKING SET'+(working.length===1?'':'S')+' LOGGED':p.reported?'REPORTED · NOT SAVED':today>p.date?'NOT LOGGED':'PLANNED'));
  target.append(tr);
 }
}
function goToSquatDay(stamp){
 if(window.RepTrackOpenCalendarDay){window.RepTrackOpenCalendarDay(stamp);return}
 document.querySelector('[data-view="calendar"]')?.click();
 const tile=[...document.querySelectorAll('#monthGrid .day')].find(b=>b.dataset.date===stamp);
 tile?.click();
}


function allExercises(){
 const host=$('analyticsExerciseList');if(!host)return;
 host.replaceChildren();
 const logs=get(),grouped=new Map();
 for(const entry of logs){
  const key=entry.exercise.trim().toLocaleLowerCase();
  if(!key)continue;
  if(!grouped.has(key))grouped.set(key,{name:entry.exercise,sets:0,days:new Set(),latest:'',top:0,weight:0});
  const g=grouped.get(key);
  g.name=entry.exercise;g.sets+=sets(entry).length;g.days.add(entry.date);
  if(entry.date>=g.latest)g.latest=entry.date;
  for(const v of sets(entry)){if(+v.weight>g.top){g.top=+v.weight;g.weight=+v.reps}}
 }
 const groups=[...grouped.values()].sort((a,b)=>b.latest.localeCompare(a.latest)||a.name.localeCompare(b.name));
 $('analyticsExerciseTotal').textContent=groups.length+' EXERCISE'+(groups.length===1?'':'S');
 if(!groups.length){host.append(dom('p','muted','No individual exercises have been saved in this browser yet. Once you record weights and reps in Calendar, every exercise will appear here.'));return}
 for(const item of groups){
  const row=dom('button','analytics-exercise-item'),info=dom('div','');
  row.type='button';
  info.append(dom('strong','',item.name),dom('small','',item.latest+' · '+item.sets+' SETS · '+item.days.size+' TRAINING DAYS'));
  const best=dom('span','',item.top?item.top+' LB × '+item.weight:'VIEW PROGRESS');
  row.append(info,best);row.addEventListener('click',()=>{
   const select=$('exerciseSelect'),overloadSelect=$('overloadExercise');
   const selected=[...select.options].find(o=>o.value.toLocaleLowerCase()===item.name.trim().toLocaleLowerCase());
   if(selected){select.value=selected.value;strength()}
   const overloadOption=[...overloadSelect.options].find(o=>o.value.toLocaleLowerCase()===item.name.trim().toLocaleLowerCase());
   if(overloadOption){overloadSelect.value=overloadOption.value;overload()}
   $('strengthChart')?.scrollIntoView({block:'center',behavior:'smooth'});
  });
  host.append(row);
 }
}
function whoopAnalytics(){
 const host=$('analyticsWhoopList');if(!host)return;
 host.replaceChildren();
 const whoop=window.RepTrackWHOOPData,connected=!!whoop?.connected,access=whoop?.workoutAccess===true;
 const valid=connected&&access&&Array.isArray(whoop.workouts)?whoop.workouts.filter(w=>w&&w.id&&Number.isFinite(Date.parse(w.start))):[];
 $('analyticsWhoopTotal').textContent=access?valid.length+' ACTIVITIES':'SYNC STATUS';
 if(!connected){
  $('analyticsWhoopNote').textContent='Connect WHOOP in the WHOOP tab to import completed activities.';
  host.append(dom('div','chart-empty','WHOOP is not connected in this browser.'));return;
 }
 if(!access){
  $('analyticsWhoopNote').textContent='Reconnect WHOOP to grant workout-reading permission; recovery and sleep access alone cannot import activities.';
  const link=dom('a','analytics-whoop-link','RECONNECT WHOOP');link.href='/api/whoop/login';host.append(link);return;
 }
 $('analyticsWhoopNote').textContent='Completed WHOOP activities update automatically while RepTrack is open. WHOOP does not expose individual Strength Trainer weights, sets or reps through this connection.';
 if(!valid.length){host.append(dom('div','chart-empty','No finished WHOOP activities found in the recent sync window.'));return}
 const uniqueTypes=new Map();
 for(const w of valid){const type=String(w.sport_name||'WHOOP Activity').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());uniqueTypes.set(type,(uniqueTypes.get(type)||0)+1)}
 const types=dom('div','whoop-activity-types');
 for(const [name,num] of uniqueTypes){types.append(dom('span','',name+' · '+num))}
 host.append(types);
 for(const w of [...valid].sort((a,b)=>Date.parse(b.start)-Date.parse(a.start)).slice(0,40)){
  const row=dom('div','analytics-whoop-item'),info=dom('div','');
  const duration=Number.isFinite(Date.parse(w.end))?Math.max(0,Math.round((Date.parse(w.end)-Date.parse(w.start))/60000)):null;
  const sport=String(w.sport_name||'WHOOP Activity').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const strain=w.score?.strain===null||w.score?.strain===undefined?'—':Number(w.score.strain).toFixed(1);
  info.append(dom('strong','',sport),dom('small','',new Date(w.start).toLocaleDateString()+(duration===null?'':' · '+duration+' MIN')+' · STRAIN '+strain));
  const heart=w.score?.average_heart_rate;
  row.append(info,dom('span','',heart==null?'WHOOP SYNC':Math.round(Number(heart))+' AVG BPM'));
  host.append(row);
 }
}

function fillSelect(elm,names){const current=elm.value;elm.replaceChildren();(names.length?names:['No logged exercises']).forEach(n=>{const option=dom('option','',n);option.value=n;elm.append(option)});if(names.includes(current))elm.value=current}
function render(){
const names=[...new Set(get().map(e=>e.exercise.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
fillSelect($('exerciseSelect'),names);fillSelect($('overloadExercise'),names);
summary();strength();overload();renderSquatMonth();allExercises();whoopAnalytics();
}
$('analyticsRange').addEventListener('change',e=>{range=Number(e.target.value);render()});
document.querySelectorAll('[data-volume-mode]').forEach(b=>b.addEventListener('click',()=>{volumeMode=b.dataset.volumeMode;document.querySelectorAll('[data-volume-mode]').forEach(x=>x.classList.toggle('active',x===b));summary()}));
document.querySelectorAll('[data-strength-mode]').forEach(b=>b.addEventListener('click',()=>{strengthMode=b.dataset.strengthMode;document.querySelectorAll('[data-strength-mode]').forEach(x=>x.classList.toggle('active',x===b));strength()}));
$('exerciseSelect').addEventListener('change',strength);
$('overloadExercise').addEventListener('change',overload);$('overloadMetric').addEventListener('change',overload);
document.querySelectorAll('[data-view="analytics"],[data-view="overload"]').forEach(b=>b.addEventListener('click',render));
$('overloadOpenCalendar').addEventListener('click',()=>{document.querySelector('[data-view="calendar"]')?.click()});
window.addEventListener('storage',e=>{if(e.key===KEY)render()});
window.addEventListener('reptrack-workouts-changed',render);
window.addEventListener('reptrack-whoop-updated',whoopAnalytics);
window.addEventListener('reptrack-whoop-manual-refresh',whoopAnalytics);
render();
})();
