
(()=>{'use strict';
const $=id=>document.getElementById(id),KEY='reptrack-workouts-v1';
const pad=n=>String(n).padStart(2,'0'),iso=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const fromISO=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const plus=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const fmt=n=>Math.round(n).toLocaleString('en-US');
const valid=e=>e&&typeof e.id==='string'&&/^\d{4}-\d\d-\d\d$/.test(e.date)&&typeof e.exercise==='string'&&Array.isArray(e.sets);
const sets=e=>e.sets.filter(s=>Number.isFinite(+s.weight)&&+s.weight>=0&&Number.isFinite(+s.reps)&&+s.reps>0);
const vol=e=>sets(e).reduce((n,s)=>n+(+s.weight)*(+s.reps),0);
const oneRM=s=>Number(s.weight)*(1+Math.min(12,Number(s.reps))/30);
const plan=[
{title:'LEGS',focus:'Lower body · posterior',ex:[['Back Squat','3 × 6–10'],['Romanian Deadlift','3 × 8–10'],['Bulgarian Split Squat','3 × 8–12'],['Leg Curl','3 × 10–15'],['Calf Raise','4 × 12–15']]},
{title:'PUSH',focus:'Chest · Shoulders · Triceps',ex:[['Bench Press','3 × 6–10'],['Incline Dumbbell Press','3 × 8–12'],['Shoulder Press','3 × 8–12'],['Lateral Raise','3 × 12–20'],['Triceps Pushdown','3 × 10–15']]},
{title:'PULL',focus:'Back · Biceps',ex:[['Lat Pulldown','3 × 8–12'],['Barbell Row','3 × 6–10'],['Seated Cable Row','3 × 10–12'],['Rear Delt Fly','3 × 12–20'],['Biceps Curl','3 × 8–12']]},
{title:'LEGS',focus:'Lower body · quad',ex:[['Back Squat','3 × 6–8'],['Leg Press','3 × 10–12'],['Leg Extension','3 × 12–15'],['Hip Thrust','3 × 8–12'],['Calf Raise','4 × 12–15']]},
{title:'CHEST',focus:'Chest · Pressing',ex:[['Bench Press','3 × 6–10'],['Incline Dumbbell Press','3 × 8–12'],['Chest Fly','3 × 10–15'],['Cable Fly','3 × 12–15'],['Push Up','2 × 12–20']]},
{title:'BACK',focus:'Lats · Upper Back',ex:[['Pull Up','3 × 6–10'],['Chest-Supported Row','3 × 8–12'],['Lat Pulldown','3 × 10–12'],['Seated Cable Row','3 × 8–12'],['Straight-Arm Pulldown','3 × 12–15']]},
{title:'SHOULDERS + ARMS',focus:'Delts · Biceps · Triceps',ex:[['Shoulder Press','3 × 6–10'],['Lateral Raise','4 × 12–20'],['Rear Delt Fly','3 × 12–15'],['Biceps Curl','3 × 8–12'],['Triceps Extension','3 × 10–15']]}
];

// Calendar plans are stored separately from logged workouts so changing a plan never edits logged sets.
const PLAN_KEY='reptrack-day-plans-v1',WEEK_KEY='reptrack-weekday-plans-v1';
function readPlanStore(key){try{const data=JSON.parse(localStorage.getItem(key)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}}
let datePlans=readPlanStore(PLAN_KEY),weeklyPlans=readPlanStore(WEEK_KEY);
const clonePlan=p=>({title:p.title,focus:p.focus,ex:p.ex.map(x=>[x[0],x[1],x[2]??''])});
const validPlan=p=>p&&typeof p.title==='string'&&p.title.length>0&&p.title.length<=50&&typeof p.focus==='string'&&p.focus.length<=120&&Array.isArray(p.ex)&&p.ex.length<=30&&p.ex.every(x=>Array.isArray(x)&&(x.length===2||x.length===3)&&typeof x[0]==='string'&&x[0].trim().length>0&&x[0].length<=100&&typeof x[1]==='string'&&x[1].length<=60&&(x.length===2||x[2]===''||(Number.isFinite(Number(x[2]))&&Number(x[2])>=0&&Number(x[2])<=100000)));
function presetFor(type,day){
 if(type==='REST')return{title:'REST',focus:'Rest and recovery',ex:[['Walking','20–30 minutes'],['Mobility','10–15 minutes']]};
 if(type==='CUSTOM')return{title:'CUSTOM',focus:'Personal session',ex:[['New Exercise','3 × 8–12']]};
 const candidate=plan.find(p=>p.title===type&&(type!=='LEGS'||day===0?p===plan[0]:p===plan[3]))||plan.find(p=>p.title===type);
 return clonePlan(candidate||plan[day]);
}
// Four-week back squat plan adapted to Wednesday and Sunday leg days.
// Prior RepTrack squat targets were 245 lb heavy, 230 lb volume, and 215 lb heel-elevated.
const squatMonth=[
 {week:1,wednesday:'2026-11-11',sunday:'2026-11-15',heavy:245,volume:230,heel:215},
 {week:2,wednesday:'2026-11-18',sunday:'2026-11-22',heavy:250,volume:235,heel:220},
 {week:3,wednesday:'2026-11-25',sunday:'2026-11-29',heavy:255,volume:240,heel:225},
 {week:4,wednesday:'2026-12-02',sunday:'2026-12-06',heavy:260,volume:245,heel:230}
];
function squatMonthWorkout(stamp){
 const w=squatMonth.find(x=>x.wednesday===stamp||x.sunday===stamp);
 if(!w)return null;
 const heavy=w.wednesday===stamp;
 const p=clonePlan(heavy?plan[3]:plan[0]);
 // Each default working set uses this weight; recorded weights can always be changed.
 p.ex=p.ex.filter(([name])=>!/^Back Squat$/i.test(name)&&!/^Heel-Elevated Squat$/i.test(name));
 p.ex.unshift(['Back Squat',heavy?'3 × 6–8':'3 × 8–10',heavy?w.heavy:w.volume]);
 if(!heavy)p.ex.splice(1,0,['Heel-Elevated Squat','3 × 10–12',w.heel]);
 p.focus+=(heavy?' · Strength':' · Volume')+' · Squat week '+w.week;
 return p;
}
window.RepTrackSquatMonth=squatMonth;

function planFor(d){
 const stamp=iso(d),day=d.getDay();
 // Today (November 9, 2026) was a legs session; only that date changes, not every Monday.
 const fallback=stamp==='2026-11-09'?presetFor('LEGS',0):(squatMonthWorkout(stamp)||clonePlan(plan[day]));
 const p=datePlans[stamp]||weeklyPlans[day]||fallback;
 return validPlan(p)?clonePlan(p):fallback;
}
function savePlanStore(key,store){try{localStorage.setItem(key,JSON.stringify(store));return true}catch{alert('Unable to save calendar changes.');return false}}
window.RepTrackPlanForDate=stamp=>planFor(fromISO(stamp));
window.RepTrackWorkoutPreset=key=>{
 const presets={PUSH:plan[1],PULL:plan[2],LEGS_QUAD:plan[3],LEGS_POSTERIOR:plan[0],CHEST:plan[4],BACK:plan[5],SHOULDERS_ARMS:plan[6]};
 if(key==='CUSTOM')return{title:'CUSTOM WORKOUT',focus:'Add exercises as you train',ex:[]};
 if(key==='REST')return{title:'RECOVERY',focus:'Walking and mobility',ex:[['Walking','20–30 minutes',''],['Mobility','10–15 minutes','']]};
 return presets[key]?clonePlan(presets[key]):null;
};
window.RepTrackSelectedDate=()=>iso(selected);

let entries=[],selected=new Date(),month=new Date(selected.getFullYear(),selected.getMonth(),1),whoop=null,modalDate=null,editingLogId=null,timer=null,seconds=120,remaining=120;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');entries=Array.isArray(x)?x.filter(valid):[]}catch{entries=[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(entries));return true}catch{alert('Unable to save workout data in this browser.');return false}}
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
const dateLabel=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const recovery=()=>{let v=whoop?.recovery?.score?.recovery_score;return v!==null&&v!==undefined&&Number.isFinite(+v)?Math.round(+v):null};
const recoveryTone=r=>r===null?'neutral':r>=67?'green':r>=34?'yellow':'red';
const readiness=r=>r===null?'AWAITING WHOOP DATA':r>=67?'HIGH RECOVERY':r>=34?'MODERATE RECOVERY':'LOW RECOVERY';
const guidance=r=>r===null?'No recovery score is available. Follow the plan and adjust effort to your energy and form.':r>=67?'Recovery is high. Normal training intensity is reasonable if you feel ready.':r>=34?'Recovery is moderate. Keep planned work manageable and avoid unnecessary all-out sets.':'Recovery is low. Consider reducing sets or load, prioritizing technique, or taking a rest day. This is a suggestion, not a diagnosis.';
function renderWHOOP(){
window.RepTrackWHOOPData=whoop;
window.RepTrackWHOOPLastSync=lastWhoopSuccess||0;
window.dispatchEvent(new Event('reptrack-whoop-updated'));

const r=recovery(),s=whoop?.sleep?.score?.sleep_performance_percentage,t=whoop?.cycle?.score?.strain;
$('recoveryMetric').textContent=r===null?'—':r+'%';
$('sleepMetric').textContent=s!==null&&s!==undefined&&Number.isFinite(+s)?Math.round(+s)+'%':'—';
$('strainMetric').textContent=t!==null&&t!==undefined&&Number.isFinite(+t)?(+t).toFixed(1):'—';
$('recoveryMetric').className='metric recovery-'+recoveryTone(r);
$('recoveryCaption').textContent=readiness(r);
$('whoopBadge').textContent=whoop?.connected?'WHOOP CONNECTED':'WHOOP NOT CONNECTED';
$('whoopBadge').classList.toggle('connected',!!whoop?.connected);
$('connDot').classList.toggle('on',!!whoop?.connected);
$('connText').textContent=whoop?.connected?'WHOOP linked':'WHOOP not linked';
$('connectLink').classList.toggle('hidden',!!whoop?.connected);
$('disconnectButton').classList.toggle('hidden',!whoop?.connected);
$('guidanceText').textContent=guidance(r);
const day=planFor(selected);
$('selectedRecovery').textContent=day.title==='RECOVERY'?'RECOVERY / MOBILITY':readiness(r);
$('selectedRecovery').className='micro recovery-'+recoveryTone(r);
$('advice').textContent=guidance(r);
}
let whoopSyncInProgress=false,lastWhoopSyncAttempt=0,lastWhoopSuccess=0;
async function syncWHOOP(force=false){
 if(whoopSyncInProgress||document.hidden||(!force&&Date.now()-lastWhoopSyncAttempt<45000))return;
 whoopSyncInProgress=true;lastWhoopSyncAttempt=Date.now();
 try{
  const res=await fetch('/api/whoop/summary',{credentials:'same-origin',cache:'no-store'});
  if(!res.ok)throw Error('Unable to retrieve WHOOP metrics');
  whoop=await res.json();
  lastWhoopSuccess=Date.now();
  $('syncMessage').textContent=whoop.connected?'WHOOP data checked at '+new Date(lastWhoopSuccess).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'. Refreshes automatically.':'WHOOP is not connected in this browser.';
 }catch(e){
  // Preserve last-known WHOOP data during temporary network failures.
  $('syncMessage').textContent='WHOOP temporarily unavailable. '+(lastWhoopSuccess?'Showing the last available readings.':'No readings available yet.');
 }finally{whoopSyncInProgress=false;renderWHOOP();}
}
function renderCalendar(){
$('monthLabel').textContent=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
const grid=$('monthGrid');grid.replaceChildren();
const first=(month.getDay()+6)%7,days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),today=iso(new Date());
const cells=Math.ceil((first+days)/7)*7;
for(let n=0;n<cells;n++){
const d=plus(month,n-first),stamp=iso(d),p=planFor(d);
const completed=entries.some(e=>e.date===stamp);
const tile=el('button','day',undefined);tile.type='button';tile.setAttribute('aria-label',dateLabel(d)+', '+p.title+(completed?', workout logged':''));tile.dataset.date=stamp;
if(d.getMonth()!==month.getMonth())tile.classList.add('out');
if(stamp===today)tile.classList.add('today');
if(stamp===iso(selected))tile.classList.add('selected');
if(completed)tile.classList.add('done');
tile.append(el('span','day-no',String(d.getDate())),el('span','day-title',p.title),el('span','day-sub',p.focus),el('span','day-foot',completed?'● LOGGED':p.title==='REST'?'REST DAY':'PLANNED'));
tile.addEventListener('click',()=>{selected=d;month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar();renderSelected();openDayDrawer(d);});
grid.append(tile);
}
}
function renderSelected(){
const p=planFor(selected),key=iso(selected),done=entries.filter(e=>e.date===key);
$('dayHeading').textContent=dateLabel(selected).toUpperCase();$('dayWorkout').textContent=p.title;$('dayFocus').textContent=p.focus;
$('logCount').textContent=done.length+' EXERCISE'+(done.length===1?'':'S')+' LOGGED';
$('exerciseList').replaceChildren();
for(const [exercise,prescription,targetWeight] of p.ex){
const row=el('div','exercise-row'),left=el('div'),btn=el('button','smallbtn btn-ghost','LOG');
left.append(el('strong','',exercise),el('small','',prescription+(targetWeight!==undefined&&targetWeight!==''?' · Target '+targetWeight+' lb':'')));btn.onclick=()=>openLog(selected,exercise);row.append(left,btn);$('exerciseList').append(row);
}
$('dayHistory').replaceChildren();
if(done.length){
$('dayHistory').append(el('div','micro','LOGGED TODAY'));
done.forEach(e=>{const line=el('div','perf-row'),detail=el('div'),actions=el('div','log-actions');detail.append(el('strong','',e.exercise),el('div','muted',sets(e).map(s=>s.weight+' × '+s.reps).join('  |  ')));const edit=el('button','smallbtn btn-ghost','EDIT');edit.type='button';edit.onclick=()=>openEditLog(e.id);const del=el('button','smallbtn btn-ghost','DELETE');del.type='button';del.onclick=()=>deleteLoggedExercise(e.id);actions.append(edit,del);line.append(detail,actions);$('dayHistory').append(line)});
}else $('dayHistory').append(el('div','muted','No exercises logged for this date.'));
$('dayStart').onclick=()=>openLog(selected,p.title==='REST'?'Walking':(p.ex[0]?.[0]||'Exercise'));
$('clearSelectedDay').classList.toggle('hidden',!done.length);
$('clearSelectedDay').onclick=()=>deleteDayLogs(key);
renderWHOOP();
}
function renderAnalytics(){
const now=new Date(),weekStart=plus(now,-6),monthStart=plus(now,-29);
const weekly=entries.filter(e=>e.date>=iso(weekStart)&&e.date<=iso(now));
$('volumeMetric').textContent=fmt(weekly.reduce((n,e)=>n+vol(e),0));
$('setsMetric').textContent=fmt(weekly.reduce((n,e)=>n+sets(e).length,0));
const squat=entries.filter(e=>/squat/i.test(e.exercise)).flatMap(sets).filter(s=>+s.weight>0);
$('squatMetric').textContent=squat.length?fmt(Math.max(...squat.map(oneRM)))+' LB':'—';
$('sessionMetric').textContent=weekly.length;
const bars=$('volumeChart');bars.replaceChildren();
const values=Array.from({length:14},(_,i)=>{const date=iso(plus(now,i-13));return{date,value:entries.filter(e=>e.date===date).reduce((n,e)=>n+vol(e),0)}});
const high=Math.max(1,...values.map(v=>v.value)),plot=el('div','chart');
values.forEach(v=>{const b=el('div','chartbar');b.style.height=Math.max(2,v.value/high*100)+'%';b.title=v.date+' — '+fmt(v.value)+' lb-reps';plot.append(b)});
bars.append(plot);
const labels=el('div','chartlabels');labels.append(el('span','',values[0].date.slice(5)),el('span','',values.at(-1).date.slice(5)));bars.append(labels);
const count=new Map();entries.filter(e=>e.date>=iso(monthStart)).forEach(e=>count.set(e.exercise,(count.get(e.exercise)||0)+sets(e).length));
const popular=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6),max=Math.max(1,...popular.map(x=>x[1]));
$('muscleWork').replaceChildren();
if(!popular.length)$('muscleWork').append(el('div','muted','Log exercises to view training distribution.'));
for(const [name,n] of popular){const wrapper=el('div',''),r=el('div','perf-row'),meter=el('div','perf-track'),fill=el('div');fill.style.width=n/max*100+'%';meter.append(fill);r.append(el('strong','',name),el('span','',n+' SETS'));wrapper.append(r,meter);$('muscleWork').append(wrapper)}
const select=$('exerciseSelect'),chosen=select.value,names=[...new Set(entries.map(e=>e.exercise))].sort();
select.replaceChildren();for(const name of names.length?names:['No exercises logged']){const o=el('option','',name);o.value=name;select.append(o)}
if(names.includes(chosen))select.value=chosen;renderExerciseTrend();
}
function renderExerciseTrend(){
const name=$('exerciseSelect').value;
const rows=entries.filter(e=>e.exercise===name).sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
const values=rows.map(e=>({date:e.date,value:Math.max(0,...sets(e).map(oneRM))}));
const high=Math.max(1,...values.map(e=>e.value)),wrap=$('strengthChart');wrap.replaceChildren();
if(!values.length){wrap.append(el('div','muted','Select a logged exercise to see estimated strength trends.'));return}
const chart=el('div','chart');for(const item of values){const b=el('div','chartbar');b.style.height=Math.max(2,item.value/high*100)+'%';b.title=item.date+' · '+fmt(item.value)+' estimated 1RM';chart.append(b)}
wrap.append(chart,el('div','muted','Top estimated 1RM: '+fmt(high)+' lbs · Epley formula, approximate.'));
}

// Interactive workout detail panel: every calendar tile opens the specific day's plan.

let editorOpen=false,editorDraft=null,editorOriginalType=null;
const planType=p=>['PUSH','PULL','LEGS','CHEST','BACK','SHOULDERS + ARMS','REST'].includes(p.title)?p.title:'CUSTOM';
function buildExerciseEditor(){
 const box=$('editExerciseRows');box.replaceChildren();
 editorDraft.ex.forEach(([name,sets,weight],index)=>{
  const row=el('div','edit-exercise-row'),n=el('input'),s=el('input'),w=el('input'),up=el('button','smallbtn','↑'),down=el('button','smallbtn','↓'),del=el('button','smallbtn','×');
  n.value=name;n.maxLength=100;n.placeholder='Exercise name';n.setAttribute('aria-label','Exercise name');
  s.value=sets;s.maxLength=60;s.placeholder='Sets × reps';s.setAttribute('aria-label','Target sets and reps');
  w.type='number';w.step='.5';w.min='0';w.inputMode='decimal';w.value=weight??'';w.placeholder='Weight lb';w.setAttribute('aria-label','Target weight in pounds');
  n.oninput=()=>editorDraft.ex[index][0]=n.value;s.oninput=()=>editorDraft.ex[index][1]=s.value;w.oninput=()=>editorDraft.ex[index][2]=w.value;
  up.type=down.type=del.type='button';up.title='Move exercise up';down.title='Move exercise down';del.title='Remove exercise';up.disabled=index===0;down.disabled=index===editorDraft.ex.length-1;
  up.onclick=()=>{[editorDraft.ex[index-1],editorDraft.ex[index]]=[editorDraft.ex[index],editorDraft.ex[index-1]];buildExerciseEditor()};
  down.onclick=()=>{[editorDraft.ex[index+1],editorDraft.ex[index]]=[editorDraft.ex[index],editorDraft.ex[index+1]];buildExerciseEditor()};
  del.onclick=()=>{editorDraft.ex.splice(index,1);buildExerciseEditor()};
  row.append(n,s,w,up,down,del);box.append(row);
 });
}
function openPlanEditor(){
 editorOpen=true;editorDraft=planFor(selected);
 editorOriginalType=planType(editorDraft);
 $('editWorkoutType').value=editorOriginalType;
 $('editWorkoutName').value=editorDraft.title;
 $('editWorkoutFocus').value=editorDraft.focus;
 $('editRepeatWeekly').checked=false;
 $('editWeekday').textContent=selected.toLocaleDateString(undefined,{weekday:'long'});
 $('editPlanMessage').textContent='';
 $('drawerPlanEditor').classList.remove('hidden');
 buildExerciseEditor();toggleCustomName();
 $('drawerEditPlan').textContent='✕ CLOSE EDITOR';
}
function closePlanEditor(){
 editorOpen=false;editorDraft=null;$('drawerPlanEditor').classList.add('hidden');$('drawerEditPlan').textContent='✎ EDIT DAY PLAN';
}
function toggleCustomName(){
 const other=$('editWorkoutType').value==='CUSTOM';
 $('customWorkoutWrap').classList.toggle('hidden',!other);
}
$('drawerEditPlan').onclick=()=>editorOpen?closePlanEditor():openPlanEditor();
$('editWorkoutType').onchange=()=>{
 if(!editorOpen)return;
 const type=$('editWorkoutType').value;
 editorDraft=presetFor(type,selected.getDay());
 $('editWorkoutName').value=editorDraft.title;
 $('editWorkoutFocus').value=editorDraft.focus;
 toggleCustomName();buildExerciseEditor();
};
$('editAddExercise').onclick=()=>{
 if(!editorOpen||editorDraft.ex.length>=30)return;
 editorDraft.ex.push(['','3 × 8–12','']);buildExerciseEditor();
 const last=$('editExerciseRows').lastElementChild;last?.querySelector('input')?.focus();
};
$('editCancelPlan').onclick=closePlanEditor;
$('editSavePlan').onclick=()=>{
 if(!editorOpen)return;
 editorDraft.title=($('editWorkoutType').value==='CUSTOM' ? $('editWorkoutName').value : $('editWorkoutType').value).trim();
 editorDraft.focus=$('editWorkoutFocus').value.trim();
 editorDraft.ex=editorDraft.ex.map(x=>[x[0].trim(),x[1].trim(),x[2]==null?'':String(x[2]).trim()]);
 if(!validPlan(editorDraft)){ $('editPlanMessage').textContent='Give the workout a name and complete or remove any blank exercise rows.';return}
 const repeat=$('editRepeatWeekly').checked,stamp=iso(selected),p=clonePlan(editorDraft);
 if(repeat){const next={...weeklyPlans,[selected.getDay()]:p};if(!savePlanStore(WEEK_KEY,next))return;weeklyPlans=next;const dates={...datePlans};delete dates[stamp];if(savePlanStore(PLAN_KEY,dates))datePlans=dates;}
 else{const next={...datePlans,[stamp]:p};if(!savePlanStore(PLAN_KEY,next))return;datePlans=next}
 closePlanEditor();renderAll();window.dispatchEvent(new Event('reptrack-plan-changed'));
};
$('editResetPlan').onclick=()=>{
 if(!confirm('Reset the selected day to the normal schedule? Your logged sets will stay saved.'))return;
 const stamp=iso(selected),d={...datePlans};delete d[stamp];
 if(!savePlanStore(PLAN_KEY,d))return;datePlans=d;
 const w={...weeklyPlans};delete w[selected.getDay()];
 if($('editRepeatWeekly').checked){if(!savePlanStore(WEEK_KEY,w))return;weeklyPlans=w}
 // A one-off override for November 9 can be reset to the weekly default rather than its initial legs fallback.
 if(stamp==='2026-11-09'&&!weeklyPlans[selected.getDay()]){const n={...datePlans,[stamp]:clonePlan(plan[selected.getDay()])};if(savePlanStore(PLAN_KEY,n))datePlans=n}
 closePlanEditor();renderAll();window.dispatchEvent(new Event('reptrack-plan-changed'));
};

let drawerOpen=false;
function openDayDrawer(date){
 selected=date;month=new Date(date.getFullYear(),date.getMonth(),1);drawerOpen=true;
 closePlanEditor();renderDayDrawer();$('dayDrawerOverlay').classList.remove('hidden');document.body.style.overflow='hidden';
 $('drawerClose').focus();
}
function closeDayDrawer(){
 drawerOpen=false;closePlanEditor();$('dayDrawerOverlay').classList.add('hidden');
 if($('modalOverlay').classList.contains('hidden'))document.body.style.overflow='';
}
function renderDayDrawer(){
 if(!drawerOpen)return;
 const p=planFor(selected),date=iso(selected),logged=entries.filter(e=>e.date===date),doneNames=new Set(logged.map(e=>e.exercise));
 $('drawerDate').textContent=dateLabel(selected).toUpperCase();
 $('drawerWorkout').textContent=p.title;
 $('drawerFocus').textContent=p.focus;
 const plannedDone=p.ex.filter(([ex])=>doneNames.has(ex)).length;
 $('drawerCount').textContent=plannedDone+' OF '+p.ex.length+' PLANNED EXERCISES LOGGED';
 $('drawerMeterFill').style.width=(p.ex.length?plannedDone/p.ex.length*100:0)+'%';
 const r=recovery();
 $('drawerGuidance').textContent=r===null?'No WHOOP recovery score available yet. Choose effort based on readiness and form.':guidance(r);
 $('drawerClearDay').classList.toggle('hidden',!logged.length);
 $('drawerClearDay').onclick=()=>deleteDayLogs(date);
 const list=$('drawerExercises');list.replaceChildren();
 p.ex.forEach(([exercise,prescription,targetWeight],i)=>{
  const row=el('div','drawer-exercise');
  const number=el('span','drawer-exercise-num',String(i+1).padStart(2,'0'));
  const desc=el('div','');desc.append(el('strong','',exercise),el('small','',prescription+(targetWeight!==undefined&&targetWeight!==''?' · Target '+targetWeight+' lb':'')));
  const btn=el('button','smallbtn '+(doneNames.has(exercise)?'':'btn-primary'),doneNames.has(exercise)?'LOG ANOTHER':'LOG SETS');
  btn.type='button';btn.onclick=()=>openLog(selected,exercise);
  row.append(number,desc,btn);list.append(row);
 });
 const past=$('drawerLogged');past.replaceChildren();
 if(!logged.length)past.append(el('p','muted','No exercises recorded yet. Tap LOG SETS above to add your workout.'));
 else logged.forEach(e=>{
  const row=el('div','drawer-exercise'),desc=el('div','');
  desc.append(el('strong','',e.exercise),el('small','',sets(e).map(x=>x.weight+' lb × '+x.reps).join(' · ')));
  const buttons=el('div','log-actions');
  const edit=el('button','smallbtn','EDIT');edit.type='button';edit.onclick=()=>openEditLog(e.id);
  const del=el('button','smallbtn','DELETE');del.type='button';del.onclick=()=>deleteLoggedExercise(e.id);
  buttons.append(edit,del);row.append(desc,buttons);past.append(row);
 });
}
$('drawerClose').onclick=closeDayDrawer;$('drawerDone').onclick=closeDayDrawer;
$('dayDrawerOverlay').addEventListener('click',e=>{if(e.target===$('dayDrawerOverlay'))closeDayDrawer()});
$('drawerAddCustom').onclick=()=>openLog(selected,'');

function renderAll(){renderCalendar();renderSelected();renderAnalytics();renderDayDrawer();window.dispatchEvent(new Event('reptrack-workouts-changed'))}
window.RepTrackLogSessionSet=(date,exercise,weight,reps,sessionId)=>{
 if(!/^\d{4}-\d\d-\d\d$/.test(date)||!exercise||!Number.isFinite(+weight)||+weight<0||!Number.isInteger(+reps)||+reps<1)return false;
 const id=String(sessionId||'').slice(0,80),existing=entries.find(e=>e.date===date&&e.exercise===exercise&&e.sessionId===id);
 if(existing){existing.sets.push({weight:+weight,reps:+reps})}
 else entries.push({id:Date.now()+'-'+Math.random().toString(36).slice(2),created:Date.now(),date,exercise:String(exercise).slice(0,100),sets:[{weight:+weight,reps:+reps}],sessionId:id,notes:''});
 if(!save())return false;
 renderAll();return true;
};
window.RepTrackSessionSetCount=(sessionId)=>entries.filter(e=>e.sessionId===sessionId).reduce((n,e)=>n+sets(e).length,0);

function addSet(weight='',reps=''){
const row=el('div','setline'),n=el('span','muted',String($('setsList').children.length+1)),w=el('input'),r=el('input'),x=el('button','del','×');
w.type='number';w.step='.5';w.min='0';w.inputMode='decimal';w.required=true;w.placeholder='lbs';w.value=weight;
r.type='number';r.step='1';r.min='1';r.inputMode='numeric';r.required=true;r.placeholder='reps';r.value=reps;x.type='button';x.title='Remove set';x.onclick=()=>{if($('setsList').children.length>1){row.remove();[...$('setsList').children].forEach((e,i)=>e.firstChild.textContent=i+1)}};
row.append(n,w,r,x);$('setsList').append(row);
}
function openLog(date,exercise){
editingLogId=null;
modalDate=iso(date);$('logDate').value=modalDate;$('logExercise').value=exercise;$('logNotes').value='';$('setsList').replaceChildren();
let prev=entries.filter(e=>e.exercise===exercise).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
const planned=planFor(date).ex.find(x=>x[0]===exercise);
const target=planned?.[2];
const explicit=target!==''&&target!==undefined&&target!==null&&Number.isFinite(Number(target));
const squatWeek=squatMonth.some(x=>x.wednesday===iso(date)||x.sunday===iso(date));
if(squatWeek&&explicit&&(exercise==='Back Squat'||exercise==='Heel-Elevated Squat')){
 const repTarget=exercise==='Heel-Elevated Squat'?10:(date.getDay()===3?6:8);
 for(let i=0;i<3;i++)addSet(target,repTarget);
}else if(prev?.sets?.length){for(const item of prev.sets.slice(0,8))addSet(item.weight,item.reps)}
else {const weight=explicit?target:'';addSet(weight);addSet(weight);addSet(weight);}
$('modalTitle').textContent='LOG WORKOUT';$('modalOverlay').classList.remove('hidden');document.body.style.overflow='hidden';$('logExercise').focus();
}
function openEditLog(id){
 const item=entries.find(e=>e.id===id);
 if(!item)return;
 editingLogId=id;
 modalDate=item.date;
 $('logDate').value=item.date;
 $('logExercise').value=item.exercise;
 $('logNotes').value=item.notes||'';
 $('setsList').replaceChildren();
 for(const s of item.sets){addSet(s.weight,s.reps)}
 if(!item.sets.length)addSet();
 $('modalTitle').textContent='EDIT LOGGED EXERCISE';
 $('modalOverlay').classList.remove('hidden');
 document.body.style.overflow='hidden';
 $('logExercise').focus();
}
function deleteLoggedExercise(id){
 const item=entries.find(e=>e.id===id);
 if(!item||!confirm('Delete '+item.exercise+' from '+item.date+'? This will remove its logged sets from your charts.'))return;
 const next=entries.filter(e=>e.id!==id);
 const previous=entries;entries=next;
 if(save()){renderAll()}else entries=previous;
}
window.RepTrackEditLoggedExercise=id=>openEditLog(id);
window.RepTrackDeleteLoggedExercise=id=>deleteLoggedExercise(id);
function deleteDayLogs(date){
 const logs=entries.filter(e=>e.date===date);
 if(!logs.length)return;
 if(!confirm('Delete all '+logs.length+' logged exercises from '+date+'? Your planned workout will remain. This cannot be undone.'))return;
 const previous=entries;entries=entries.filter(e=>e.date!==date);
 if(save())renderAll();else entries=previous;
}
function closeLog(){$('modalOverlay').classList.add('hidden');editingLogId=null;if(!drawerOpen)document.body.style.overflow=''}
$('logForm').addEventListener('submit',ev=>{
ev.preventDefault();const exercise=$('logExercise').value.trim(),date=$('logDate').value;
const rows=[...$('setsList').children].map(row=>({weight:Number(row.children[1].value),reps:Number(row.children[2].value)}));
if(!exercise||!date||rows.some(s=>!Number.isFinite(s.weight)||s.weight<0||!Number.isInteger(s.reps)||s.reps<1)){alert('Check the exercise, date, weight and reps.');return}
const item={id:Date.now()+'-'+Math.random().toString(36).slice(2),created:Date.now(),date,exercise:exercise.slice(0,100),sets:rows,notes:$('logNotes').value.slice(0,1000)};
const previous=entries.slice(),editedIndex=editingLogId?entries.findIndex(e=>e.id===editingLogId):-1;
if(editingLogId&&editedIndex===-1){alert('The original workout entry is no longer available.');return}
if(editedIndex>=0)entries[editedIndex]={...entries[editedIndex],date:item.date,exercise:item.exercise,sets:item.sets,notes:item.notes};
else entries.push(item);
if(save()){selected=fromISO(date);month=new Date(selected.getFullYear(),selected.getMonth(),1);editingLogId=null;closeLog();renderAll()}
else entries=previous;
});
$('addSet').onclick=()=>addSet();$('closeModal').onclick=closeLog;$('cancelModal').onclick=closeLog;
$('modalOverlay').addEventListener('click',e=>{if(e.target===$('modalOverlay'))closeLog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modalOverlay').classList.contains('hidden'))closeLog();else if(drawerOpen)closeDayDrawer()}});
$('prevMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderCalendar()};
$('nextMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderCalendar()};
$('todayButton').onclick=()=>{selected=new Date();month=new Date(selected.getFullYear(),selected.getMonth(),1);renderAll()};
$('exerciseSelect').onchange=renderExerciseTrend;
$('disconnectButton').onclick=async()=>{if(!confirm('Disconnect WHOOP from this browser?'))return;await fetch('/api/whoop/logout',{method:'POST'});whoop={connected:false};renderWHOOP()};
$('backupButton').onclick=()=>{const blob=new Blob([JSON.stringify(entries,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='reptrack-backup-'+iso(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('restoreInput').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(!Array.isArray(d)||!d.every(valid))throw Error();if(!confirm('Merge '+d.length+' workout records into this browser?'))return;const ids=new Set(entries.map(x=>x.id));for(const e of d)if(!ids.has(e.id)){entries.push(e);ids.add(e.id)}if(save())renderAll()}catch{alert('Invalid RepTrack JSON backup.')}finally{ev.target.value=''}});
function paintTimer(){$('clock').textContent=pad(Math.floor(remaining/60))+':'+pad(remaining%60);$('timerStart').textContent=timer?'PAUSE':'START'}
$('timerStart').onclick=()=>{if(timer){clearInterval(timer);timer=null;paintTimer();return}if(remaining<=0)remaining=seconds;timer=setInterval(()=>{remaining=Math.max(0,remaining-1);if(!remaining){clearInterval(timer);timer=null;if(navigator.vibrate)navigator.vibrate(100)}paintTimer()},1000);paintTimer()};
$('timerReset').onclick=()=>{clearInterval(timer);timer=null;remaining=seconds;paintTimer()};
document.querySelectorAll('[data-timer]').forEach(b=>b.onclick=()=>{clearInterval(timer);timer=null;seconds=Number(b.dataset.timer);remaining=seconds;paintTimer()});
const navButtons=[...document.querySelectorAll('[data-view]')];
function switchView(view){for(const b of navButtons)b.classList.toggle('active',b.dataset.view===view);for(const e of document.querySelectorAll('[data-page]'))e.classList.toggle('hidden',e.dataset.page!==view);window.scrollTo(0,0)}
navButtons.forEach(b=>b.onclick=()=>switchView(b.dataset.view));
const hash=location.hash.replace('#','');if(['calendar','analytics','overload','workout'].includes(hash))switchView(hash);
window.addEventListener('storage',e=>{if(e.key===KEY){load();renderAll()}else if(e.key===PLAN_KEY||e.key===WEEK_KEY){datePlans=readPlanStore(PLAN_KEY);weeklyPlans=readPlanStore(WEEK_KEY);renderAll();window.dispatchEvent(new Event('reptrack-plan-changed'))}});
load();renderAll();paintTimer();syncWHOOP(true);
// Poll whenever the app is in the foreground. WHOOP's API may not update every minute.
setInterval(()=>{if(!document.hidden)syncWHOOP()},60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncWHOOP()});
window.addEventListener('focus',()=>syncWHOOP());
window.addEventListener('online',()=>syncWHOOP(true));
})();