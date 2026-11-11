
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
// Historical leg-day variants preserved in seeded personal plan.
const personalPlan=window.RepTrackPersonalPlan;
const squatMonth=personalPlan.squatMonth;
function squatMonthWorkout(stamp){
 const w=squatMonth.find(x=>x.wednesday===stamp||x.sunday===stamp);
 if(!w)return null;
 const heavy=w.wednesday===stamp;
 const p=clonePlan(heavy?plan[3]:plan[0]);
 // Each default working set uses this weight; recorded weights can always be changed.
 p.ex=p.ex.filter(([name])=>!/^Back Squat$/i.test(name)&&!/^Heel-Elevated Squat$/i.test(name));
 p.ex.unshift(['Back Squat',heavy?(w.light?'2 × 6–8':'3 × 6–8'):'3 × 8–10',heavy?w.heavy:w.volume]);
 if(!heavy)p.ex.splice(1,0,['Heel-Elevated Squat','3 × 10–12',w.heel]);
 p.focus+=(w.light?' · Light technique / recovery':heavy?' · Strength':' · Volume')+' · Squat week '+w.week;
 return p;
}
window.RepTrackSquatMonth=squatMonth;

// Experiments are virtual calendar additions, not destructive edits of the saved base plans.
const EXPERIMENT_KEY='reptrack-experiments-v1';
function readExperiment(){try{const v=JSON.parse(localStorage.getItem(EXPERIMENT_KEY)||'null');return v&&typeof v==='object'?v:null}catch{return null}}
let experiment=readExperiment();
// Guaranteed 30-day daily squat schedule, shared by phone and desktop.
// Original 30-day progression is stored as seeded plan data, not logged history.
// Two working sets every day; every day's ordinary workout is otherwise preserved.
const DAILY_SQUAT_START=fromISO(personalPlan.start);
const DAILY_SQUAT_30=personalPlan.dailySquats;
function dailySquatTarget(date){
 const day=date instanceof Date?date:fromISO(date);
 const idx=Math.round((Date.UTC(day.getFullYear(),day.getMonth(),day.getDate())-Date.UTC(DAILY_SQUAT_START.getFullYear(),DAILY_SQUAT_START.getMonth(),DAILY_SQUAT_START.getDate()))/86400000);
 if(idx<0||idx>=DAILY_SQUAT_30.length)return null;
 const [weight,reps]=DAILY_SQUAT_30[idx];
 return {day:idx+1,weight,reps,sets:2,percentage:Math.round(weight/(Number(personalPlan.max)||325)*100),baseline:idx<=1};
}
window.RepTrackDailySquatTarget=stamp=>dailySquatTarget(stamp);

const EXPERIMENT_PERCENTAGES=personalPlan.weeklyPercentages; // Sun through Sat
const experimentDate=(date)=>iso(date instanceof Date?date:fromISO(date));
const experimentDaysElapsed=(date,exp)=>{
 if(!exp?.start)return null;
 const a=fromISO(exp.start),b=date instanceof Date?date:fromISO(date);
 return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
};
function experimentPrescription(date,exp=experiment){
 const daily=dailySquatTarget(date);
 if(daily)return daily;
 const index=experimentDaysElapsed(date,exp);
 if(!exp?.active||index===null||index<0||index>=30)return null;
 const dateObj=date instanceof Date?date:fromISO(date);
 const week=Math.floor(index/7),dow=dateObj.getDay();
 const max=Number(exp.max)||325;
 const proposed=Number(exp?.percentages?.[dow]);
 const percentage=Number.isFinite(proposed)&&proposed>=20&&proposed<=95?proposed:EXPERIMENT_PERCENTAGES[dow];
 let weight=Math.max(5,Math.round(max*percentage/100/5)*5);
 // Preserve the earlier heavy/volume working weights during this exact programmed block.
 const stamp=experimentDate(date);
 const programmed=squatMonth.find(x=>x.wednesday===stamp||x.sunday===stamp);
 if(programmed&&max===325&&percentage===EXPERIMENT_PERCENTAGES[dow]){
  weight=programmed.wednesday===stamp?programmed.heavy:programmed.volume;
 }
 const adjustedPct=Math.round(weight/max*100);
 const reps=adjustedPct>=70?'2 × 5–6':adjustedPct>=60?'2 × 6–8':'2 × 8–10';
 return {weight,percentage:adjustedPct,sets:2,reps,week:week+1,day:index+1};
}
function applySquatExperiment(planObject,date){
 const p=clonePlan(planObject),prescription=experimentPrescription(date);
 if(!prescription)return p;
 // Replace existing Back Squat instead of adding duplicate squat movements on leg days.
 p.ex=p.ex.filter(([name])=>!/^Back Squat$/i.test(name));
 p.ex.unshift(['Back Squat','2 working sets × '+(prescription.reps||6)+' reps · WU 45×4, 135×8',prescription.weight]);
 p.focus+=' · Squat Every Day '+intensityLabel(prescription.percentage)+' · '+prescription.percentage+'%';
 return p;
}
window.RepTrackExperimentPrescription=stamp=>experimentPrescription(stamp);
window.RepTrackApplyExperiments=(planObject,stamp)=>planObject?applySquatExperiment(planObject,stamp):null;
window.RepTrackExperimentStatus=()=>experiment;
function updateExperimentState(){
 experiment=readExperiment();
 renderAll();
 window.dispatchEvent(new Event('reptrack-plan-changed'));
}
window.addEventListener('reptrack-experiments-changed',updateExperimentState);

function planFor(d){
 const stamp=iso(d),day=d.getDay();
 // Day-specific saved overrides always take priority over these initial defaults.
 const fallback=stamp===personalPlan.baseline?.date?presetFor('LEGS',0):(squatMonthWorkout(stamp)||clonePlan(plan[day]));
 const p=datePlans[stamp]||weeklyPlans[day]||fallback;
 return applySquatExperiment(validPlan(p)?p:fallback,d);
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
window.RepTrackOpenCalendarDay=stamp=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(stamp))return;
 const d=fromISO(stamp);
 if(Number.isNaN(d.getTime())||iso(d)!==stamp)return;
 selected=d;month=new Date(d.getFullYear(),d.getMonth(),1);
 document.querySelector('[data-view="calendar"]')?.click();
 renderCalendar();renderSelected();openDayDrawer(d);
};

let entries=[],selected=new Date(),month=new Date(selected.getFullYear(),selected.getMonth(),1),whoop=null,modalDate=null,editingLogId=null,timer=null,seconds=120,remaining=120;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');entries=Array.isArray(x)?x.filter(valid):[]}catch{entries=[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(entries));return true}catch{alert('Unable to save workout data in this browser.');return false}}
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
const dateLabel=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const recovery=()=>{let v=whoop?.recovery?.score?.recovery_score;return v!==null&&v!==undefined&&Number.isFinite(+v)?Math.round(+v):null};
const recoveryTone=r=>r===null?'neutral':r>=67?'green':r>=34?'yellow':'red';
const readiness=r=>r===null?'AWAITING WHOOP DATA':r>=67?'HIGH RECOVERY':r>=34?'MODERATE RECOVERY':'LOW RECOVERY';
const guidance=r=>r===null?'Adjust effort to your energy and form.':r>=67?'Recovery is high. Normal training intensity is reasonable if you feel ready.':r>=34?'Recovery is moderate. Keep planned work manageable and avoid unnecessary all-out sets.':'Recovery is low. Consider reducing sets or load, prioritizing technique, or taking a rest day. This is a suggestion, not a diagnosis.';
let whoopSyncInProgress=false,lastWhoopSyncAttempt=0,lastWhoopSuccess=0,whoopState='loading',whoopError='';
const whoopStateLabel=()=>whoopState==='connected'?'WHOOP CONNECTED':whoopState==='disconnected'?'CONNECT WHOOP':whoopState==='waking'?'WAKING UP SERVER…':whoopState==='error'?'WHOOP UNAVAILABLE':'CHECKING WHOOP';
function renderWHOOP(){
 window.RepTrackWHOOPData=whoop;
 window.RepTrackWHOOPLastSync=whoopState==='connected'?lastWhoopSuccess:0;
 window.RepTrackWHOOPStatus={state:whoopState,error:whoopError,lastSync:lastWhoopSuccess,connected:whoopState==='connected'};
 const connected=whoopState==='connected',r=connected?recovery():null;
 const score=connected?whoop?.sleep?.score?.sleep_performance_percentage:null;
 const strain=connected?whoop?.cycle?.score?.strain:null;
 $('whoopBadge').textContent=whoopStateLabel();
 $('whoopBadge').classList.toggle('connected',connected);
 $('connDot').classList.toggle('on',connected);
 $('connText').textContent=whoopStateLabel();
 $('connectLink').classList.add('hidden'); // Connect through the single WHOOP tab card.
 $('disconnectButton').classList.toggle('hidden',!connected);
 $('recoveryMetric').textContent=r===null?'NO DATA':r+'%';
 $('sleepMetric').textContent=score==null||!Number.isFinite(+score)?'NO DATA':Math.round(+score)+'%';
 $('strainMetric').textContent=strain==null||!Number.isFinite(+strain)?'NO DATA':(+strain).toFixed(1);
 $('recoveryMetric').className='metric recovery-'+recoveryTone(r);
 $('recoveryCaption').textContent=connected?(r===null?'NOT AVAILABLE':readiness(r)):'WHOOP';
 $('selectedRecovery').textContent=connected&&r!==null?readiness(r):'';
 $('selectedRecovery').className='micro recovery-'+recoveryTone(r);
 const advice=connected&&r!==null?guidance(r):'';
 $('guidanceText').textContent=advice; // Only one recovery explanation on the calendar.
 $('advice').textContent=connected&&r!==null?'See recovery guidance for today.':'See WHOOP tab for connection status.';
 $('syncMessage').textContent=connected?'Connected · Last successful update '+new Date(lastWhoopSuccess).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):whoopStateLabel();
 window.dispatchEvent(new Event('reptrack-whoop-updated'));
}
async function syncWHOOP(force=false){
 if(whoopSyncInProgress||document.hidden||(!force&&Date.now()-lastWhoopSyncAttempt<45000))return;
 whoopSyncInProgress=true;lastWhoopSyncAttempt=Date.now();
 const controller=new AbortController();
 let slowTimer=null,abortTimer=null;
 whoopError='';whoopState=lastWhoopSuccess?'connected':'loading';
 renderWHOOP();
 try{
  slowTimer=setTimeout(()=>{if(whoopSyncInProgress){whoopState='waking';renderWHOOP()}},4000);
  abortTimer=setTimeout(()=>controller.abort(),28000);
  const res=await fetch('/api/whoop/summary',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(!res.ok)throw Error('WHOOP server returned '+res.status);
  const result=await res.json();
  whoop=result;lastWhoopSuccess=Date.now();
  whoopState=result.connected?'connected':'disconnected';
 }catch(e){
  whoopState='error';whoopError=e?.name==='AbortError'?'Connection timed out. The server may be starting up.':e?.message||'Could not contact WHOOP.';
 }finally{
  clearTimeout(slowTimer);clearTimeout(abortTimer);
  whoopSyncInProgress=false;renderWHOOP();renderCalendar();renderSelected();renderDayDrawer();
 }
}
window.RepTrackRetryWHOOP=()=>syncWHOOP(true);
// 30-day back-squat check-in, November 9–December 8 inclusive.
// A completed day requires at least one real Back Squat set; a planned set never qualifies.
const SQUAT_START=fromISO(personalPlan.start),SQUAT_TOTAL_DAYS=Number(personalPlan.duration)||30;
const isBackSquatLog=e=>/\bback\s+squat\b/i.test(e.exercise||'')&&sets(e).length>0;
function backSquatDates(){return new Set(entries.filter(isBackSquatLog).map(e=>e.date))}
function renderSquatTracker(){
 const dates=backSquatDates(),today=iso(new Date()),trackerStart=SQUAT_START,start=iso(trackerStart),end=iso(plus(trackerStart,SQUAT_TOTAL_DAYS-1));
 $('squatTrackerWindow').textContent=trackerStart.toLocaleDateString(undefined,{month:'short',day:'numeric'}).toUpperCase()+' – '+plus(trackerStart,29).toLocaleDateString(undefined,{month:'short',day:'numeric'}).toUpperCase()+' · 30-DAY SQUAT CHECK-IN';
 const box=$('squatTrackerDays');box.replaceChildren();
 let completed=0,elapsed=0;
 for(let i=0;i<SQUAT_TOTAL_DAYS;i++){
  const date=plus(trackerStart,i),stamp=iso(date),logged=dates.has(stamp),past=stamp<=today;
  if(logged)completed++;
  if(past)elapsed++;
  const button=el('button','squat-day-chip'+(logged?' completed':past?' missed':' future'),logged?'✓':String(i+1));
  button.type='button';
  button.title='Day '+(i+1)+' · '+stamp+(logged?' · Back squat logged':past?' · No back squat logged':' · Upcoming');
  button.setAttribute('aria-label',button.title);
  button.addEventListener('click',()=>{selected=date;month=new Date(date.getFullYear(),date.getMonth(),1);renderCalendar();renderSelected();openDayDrawer(date)});
  box.append(button);
 }
 $('squatDayCount').textContent=completed+' / 30 DAYS';
 $('squatTrackerFill').style.width=completed/SQUAT_TOTAL_DAYS*100+'%';
 const finished=today>end,upcoming=today<start;
 $('squatTrackerStatus').textContent=finished?'FINAL REPORT':upcoming?'UPCOMING':'DAY '+Math.min(30,elapsed)+' / 30';
 $('squatTrackerNote').textContent=finished
  ?'30-day result: You logged back squats on '+completed+' out of 30 days ('+Math.round(completed/30*100)+'%). ✓ on calendar days means sets were actually logged.'
  :completed+' completed back-squat day'+(completed===1?'':'s')+' · '+(upcoming?30:Math.max(0,30-elapsed))+' days remaining. ✓ means a Back Squat set was actually logged, not just planned.';
}

// Completed workout sessions are separate from plans and in-progress session drafts.
const COMPLETED_KEY='reptrack-sessions-v1';
function completedSessions(){try{const v=JSON.parse(localStorage.getItem(COMPLETED_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)):[]}catch{return []}}
function renderCompletedForDate(host,date){
 host.replaceChildren();
 const completed=completedSessions().filter(x=>x.date===date);
 for(const item of completed){
  const card=el('div','completed-workout-card'),info=el('div','');
  info.append(el('strong','','✓ '+item.title+' · SAVED'),el('small','',Number(item.sets||0)+' SETS · '+fmt(Number(item.volume||0))+' LB-REPS · '+Math.max(0,Math.floor(Number(item.duration||0)/60))+' MIN'));
  const remove=el('button','smallbtn btn-ghost','DELETE');remove.type='button';remove.onclick=()=>window.RepTrackDeleteCompletedSession(item.id);
  card.append(info,remove);host.append(card);
 }
}
window.RepTrackSaveCompletedSession=(summary,staged)=>{
 if(!summary||!/^session-[a-zA-Z0-9-]+$/.test(summary.id)||!/^\d{4}-\d{2}-\d{2}$/.test(summary.date)||!Array.isArray(staged)||staged.length>60)return false;
 const priorLogs=entries.slice(),priorSessions=completedSessions();
 if(priorSessions.some(x=>x.id===summary.id))return false;
 const prepared=[];
 for(const record of staged){
  if(!record||typeof record.exercise!=='string'||!record.exercise.trim()||!Array.isArray(record.sets)||record.sets.length>200)return false;
  const workSets=record.sets.map(set=>({weight:Number(set.weight),reps:Number(set.reps),warmup:!!set.warmup}));
  if(workSets.some(set=>!Number.isFinite(set.weight)||set.weight<0||!Number.isInteger(set.reps)||set.reps<1))return false;
  if(workSets.length)prepared.push({id:Date.now()+'-'+Math.random().toString(36).slice(2),created:summary.started,date:summary.date,exercise:record.exercise.slice(0,100),sets:workSets,sessionId:summary.id,notes:''});
 }
 // Legacy session logs might already be in the calendar. Replace only those belonging to this session.
 entries=entries.filter(e=>e.sessionId!==summary.id).concat(prepared);
 if(!save()){entries=priorLogs;return false}
 try{localStorage.setItem(COMPLETED_KEY,JSON.stringify([...priorSessions.slice(-199),summary]))}
 catch{entries=priorLogs;save();return false}
 selected=fromISO(summary.date);month=new Date(selected.getFullYear(),selected.getMonth(),1);
 renderAll();return true;
};
window.RepTrackDiscardDraftSession=id=>{
 if(typeof id!=='string')return;
 // Existing app versions recorded draft sets directly to workout history.
 if(entries.some(e=>e.sessionId===id)&&!completedSessions().some(x=>x.id===id)){
  const prev=entries;entries=entries.filter(e=>e.sessionId!==id);
  if(save())renderAll();else entries=prev;
 }
};
window.RepTrackDeleteCompletedSession=id=>{
 const record=completedSessions().find(x=>x.id===id);
 if(!record||!confirm('Delete the saved '+record.title+' workout from '+record.date+' and all its logged sets?'))return;
 const sessions=completedSessions().filter(x=>x.id!==id),prior=entries;
 entries=entries.filter(e=>e.sessionId!==id);
 if(!save()){entries=prior;return}
 try{localStorage.setItem(COMPLETED_KEY,JSON.stringify(sessions))}
 catch{entries=prior;save();return}
 renderAll();
};

function whoopActivities(){
 return whoop?.connected&&whoop?.workoutAccess&&Array.isArray(whoop.workouts)?whoop.workouts.filter(w=>w&&typeof w.id==='string'&&typeof w.start==='string'):[];
}
function whoopActivityDate(activity){
 const timestamp=Date.parse(activity.start);if(!Number.isFinite(timestamp))return '';
 const tz=/^([+-])(\d{2}):(\d{2})$/.exec(activity.timezone_offset||'');
 const offset=tz?(tz[1]==='-'?-1:1)*(Number(tz[2])*60+Number(tz[3]))*60000:0;
 return new Date(timestamp+offset).toISOString().slice(0,10);
}
function whoopActivitiesOn(date){return whoopActivities().filter(x=>whoopActivityDate(x)===date)}
const whoopWorkoutName=w=>String(w.sport_name||'WHOOP Workout').replace(/[_-]/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
function renderWhoopDay(host,date){
 if(!host)return;host.replaceChildren();
 const matches=whoopActivitiesOn(date);
 if(!matches.length)return;
 host.append(el('div','micro','WHOOP SYNCED ACTIVITIES'));
 for(const workout of matches){
  const card=el('div','whoop-calendar-card'),info=el('div','');
  const duration=Math.max(0,Math.round((Date.parse(workout.end)-Date.parse(workout.start))/60000));
  const score=workout.score||{};
  const strain=Number.isFinite(Number(score.strain))&&score.strain!==null?Number(score.strain).toFixed(1):'—';
  const hr=score.average_heart_rate==null?'—':Math.round(Number(score.average_heart_rate));
  info.append(el('strong','','✓ '+whoopWorkoutName(workout)),el('small','',duration+' MIN · STRAIN '+strain+' · AVG HR '+hr+' BPM'));
  card.append(info);host.append(card);
 }
}

const intensityBand=percent=>percent>=75?'heavy':percent>=55?'moderate':percent>=40?'light':'recovery';
const intensityLabel=percent=>({heavy:'Heavy',moderate:'Moderate',light:'Light',recovery:'Recovery'})[intensityBand(percent)];
const workoutStatus=date=>{
 const stamp=typeof date==='string'?date:iso(date);
 if(entries.some(e=>e.date===stamp&&sets(e).length)||completedSessions().some(e=>e.date===stamp)||whoopActivitiesOn(stamp).length)return 'Completed';
 try{const draft=JSON.parse(localStorage.getItem('reptrack-live-session-v1')||'null');if(draft?.date===stamp)return 'In progress'}catch{}
 return 'Planned';
};
const squatStatus=date=>{
 const stamp=typeof date==='string'?date:iso(date);
 if(entries.some(e=>e.date===stamp&&/\bback\s+squat\b/i.test(e.exercise)&&sets(e).length))return 'Completed';
 try{const draft=JSON.parse(localStorage.getItem('reptrack-live-session-v1')||'null');if(draft?.date===stamp&&draft?.logs?.some(x=>/\bback\s+squat\b/i.test(x.exercise||'')&&x.sets?.length))return 'In progress'}catch{}
 return 'Planned';
};
window.RepTrackSquatStatus=stamp=>squatStatus(stamp);

function renderCalendar(){
$('monthLabel').textContent=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
const grid=$('monthGrid');grid.replaceChildren();
const first=(month.getDay()+6)%7,days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),today=iso(new Date());
const cells=Math.ceil((first+days)/7)*7;
for(let n=0;n<cells;n++){
const d=plus(month,n-first),stamp=iso(d),p=planFor(d);
const savedRecord=completedSessions().filter(x=>x.date===stamp).at(-1),whoopRecord=whoopActivitiesOn(stamp).at(0),completed=workoutStatus(stamp)==='Completed';
const squatExperiment=experimentPrescription(d),status=workoutStatus(stamp),squatDone=squatStatus(stamp)==='Completed';
const workoutName=savedRecord?.title||(whoopRecord?whoopWorkoutName(whoopRecord):p.title);
const tile=el('button','day status-'+status.toLowerCase().replace(/\s/g,'-'));tile.type='button';tile.dataset.date=stamp;
tile.setAttribute('aria-label',dateLabel(d)+' · '+workoutName+' · '+status+(squatExperiment?' · Squat '+squatExperiment.weight+' lb at '+squatExperiment.percentage+' percent':''));
if(d.getMonth()!==month.getMonth())tile.classList.add('out');
if(stamp===today)tile.classList.add('today');
if(stamp===iso(selected))tile.classList.add('selected');
if(completed)tile.classList.add('done');
if(squatDone)tile.classList.add('squat-done');
tile.append(el('span','day-no',String(d.getDate())),el('span','day-title',workoutName),el('span','day-status',status==='Completed'?'✓':status==='In progress'?'◐':'○'));
if(squatExperiment){
 const band=intensityBand(squatExperiment.percentage),badge=el('span','experiment-calendar-tag intensity-'+band,'SQ '+squatExperiment.weight);
 badge.title=intensityLabel(squatExperiment.percentage)+' · '+squatExperiment.percentage+'% 1RM · 2 working sets';
 tile.append(badge);
}
tile.addEventListener('click',()=>{selected=d;month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar();renderSelected();openDayDrawer(d);});
grid.append(tile);
}
}
function renderDailySquatWorkout(host,date){
 if(!host)return;
 const target=dailySquatTarget(date),stamp=iso(date instanceof Date?date:fromISO(date));
 host.replaceChildren();
 host.classList.toggle('hidden',!target);
 if(!target)return;
 const logged=entries.filter(e=>e.date===stamp&&/^Back Squat$/i.test(e.exercise)).flatMap(e=>sets(e));
 const work=logged.filter(v=>!v.warmup);
 const heading=el('div','daily-squat-head');
 const title=el('div','');title.append(el('div','micro','DAILY SQUAT · DAY '+target.day+' / 30'),el('h3','','BACK SQUAT · 2 WORKING SETS'));
 heading.append(title,el('span','daily-squat-percent intensity-'+intensityBand(target.percentage),intensityLabel(target.percentage)+' · '+target.percentage+'%'));
 host.append(heading);
 host.append(el('div','daily-squat-warmups','WARMUPS: 45 LB × 4 · 135 LB × 8'));
 const rows=el('div','daily-squat-working');
 for(let i=0;i<2;i++){
  const actual=work[i],row=el('div','daily-squat-set');
  row.append(el('span','', 'SET '+(i+1)),el('strong','',actual?actual.weight+' LB × '+actual.reps:target.weight+' LB × '+target.reps),el('small','status-'+(actual?'completed':squatStatus(stamp).toLowerCase().replace(/\s/g,'-')),actual?'✓ Completed':squatStatus(stamp)));
  rows.append(row);
 }
 host.append(rows);
 const note=el('p','daily-squat-note',logged.length?'Saved working sets appear above. You can still edit weights and reps.':'Planned sets do not count as complete. Save actual Back Squat sets to finish the day.');
 host.append(note);

}

function renderSelected(){
const p=planFor(selected),key=iso(selected),done=entries.filter(e=>e.date===key);
const whoopDone=whoopActivitiesOn(key),savedDone=completedSessions().filter(e=>e.date===key);
const finished=whoopDone.length>0||savedDone.length>0||done.length>0;
const actualTitle=savedDone.at(-1)?.title||(whoopDone.length?whoopWorkoutName(whoopDone.at(-1)):done.length?p.title+' · LOGGED':p.title);
$('dayHeading').textContent=dateLabel(selected).toUpperCase();$('dayWorkout').textContent=actualTitle;
$('dayFocus').textContent=finished?'COMPLETED WORKOUT · ACTUAL TRAINING HISTORY':p.focus;
renderDailySquatWorkout($('dailySquatSelected'),selected);
$('selectedWorkoutResult').classList.toggle('hidden',!finished);
$('selectedPlannedSection').classList.toggle('hidden',finished);
$('selectedAdditionalActions').classList.toggle('hidden',!finished);
$('selectedResultHeading').textContent=actualTitle;
$('selectedResultInfo').textContent=whoopDone.length+' WHOOP ACTIVIT'+(whoopDone.length===1?'Y':'IES')+' · '+savedDone.length+' SAVED SESSION'+(savedDone.length===1?'':'S')+' · '+done.reduce((n,e)=>n+sets(e).length,0)+' LOGGED SETS';
$('logCount').textContent=done.length+' EXERCISE'+(done.length===1?'':'S')+' LOGGED';
$('exerciseList').replaceChildren();
for(const [exercise,prescription,targetWeight] of p.ex){
const row=el('div','exercise-row'),left=el('div');
left.append(el('strong','',exercise),el('small','',prescription+(targetWeight!==undefined&&targetWeight!==''?' · Target '+targetWeight+' lb':'')));row.append(left);$('exerciseList').append(row);
}
renderWhoopDay($('whoopSelectedDay'),key);
renderCompletedForDate($('completedDayWorkouts'),key);
$('dayHistory').replaceChildren();
if(done.length){
$('dayHistory').append(el('div','micro','LOGGED TODAY'));
done.forEach(e=>{const line=el('div','perf-row'),detail=el('div'),actions=el('div','log-actions');detail.append(el('strong','',e.exercise),el('div','muted',sets(e).map(s=>(s.warmup?'WARMUP ':'')+s.weight+' × '+s.reps).join('  |  ')));const edit=el('button','smallbtn btn-ghost','EDIT');edit.type='button';edit.onclick=()=>openEditLog(e.id);const del=el('button','smallbtn btn-ghost','DELETE');del.type='button';del.onclick=()=>deleteLoggedExercise(e.id);actions.append(edit,del);line.append(detail,actions);$('dayHistory').append(line)});
}else if(!finished)$('dayHistory').append(el('div','muted','No exercises logged for this date.'));
$('dayStart').textContent=iso(selected)===iso(new Date())?"LOG TODAY'S WORKOUT":"LOG THIS DAY'S WORKOUT";
$('dayStart').onclick=()=>openLog(selected,p.title==='REST'?'Walking':(p.ex[0]?.[0]||'Exercise'));
$('editWeekday').textContent=selected.toLocaleDateString(undefined,{weekday:'long'});
$('addAfterWorkout').onclick=()=>openLog(selected,'');
$('clearSelectedDay').classList.toggle('hidden',!done.length);
$('clearSelectedDay').onclick=()=>deleteDayLogs(key);
renderWHOOP();
}
function renderAnalytics(){
const now=new Date(),weekStart=plus(now,-6),monthStart=plus(now,-29);
const weekly=entries.filter(e=>e.date>=iso(weekStart)&&e.date<=iso(now));
$('volumeMetric').textContent=weekly.length?fmt(weekly.reduce((n,e)=>n+vol(e),0)):'Log your first workout';
$('setsMetric').textContent=weekly.length?fmt(weekly.reduce((n,e)=>n+sets(e).length,0)):'No sets yet';
const squat=entries.filter(e=>/squat/i.test(e.exercise)).flatMap(sets).filter(s=>+s.weight>0);
$('squatMetric').textContent=squat.length?fmt(Math.max(...squat.map(oneRM)))+' LB':'Log squats to see your max';
$('sessionMetric').textContent=weekly.length||'No workouts yet';
const bars=$('volumeChart');bars.replaceChildren();
if(!weekly.length)bars.append(el('div','chart-empty','Log your first workout to see trends.'));
const values=Array.from({length:14},(_,i)=>{const date=iso(plus(now,i-13));return{date,value:entries.filter(e=>e.date===date).reduce((n,e)=>n+vol(e),0)}});
const high=Math.max(1,...values.map(v=>v.value)),plot=el('div','chart');
if(weekly.length){values.forEach(v=>{const b=el('div','chartbar');b.style.height=Math.max(2,v.value/high*100)+'%';b.title=v.date+' — '+fmt(v.value)+' lb-reps';plot.append(b)});
bars.append(plot);
const labels=el('div','chartlabels');labels.append(el('span','',values[0].date.slice(5)),el('span','',values.at(-1).date.slice(5)));bars.append(labels)}
const count=new Map();entries.filter(e=>e.date>=iso(monthStart)).forEach(e=>count.set(e.exercise,(count.get(e.exercise)||0)+sets(e).length));
const popular=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6),max=Math.max(1,...popular.map(x=>x[1]));
$('muscleWork').replaceChildren();
if(!popular.length)$('muscleWork').append(el('div','muted','Log your first workout to see training distribution.'));
for(const [name,n] of popular){const wrapper=el('div',''),r=el('div','perf-row'),meter=el('div','perf-track'),fill=el('div');fill.style.width=n/max*100+'%';meter.append(fill);r.append(el('strong','',name),el('span','',n+' SETS'));wrapper.append(r,meter);$('muscleWork').append(wrapper)}
// Exercise Library owns the analytics selectors so unlogged exercises stay selectable.
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
 const whoopDone=whoopActivitiesOn(date),savedDone=completedSessions().filter(e=>e.date===date);
 const finished=whoopDone.length>0||savedDone.length>0||logged.length>0;
 const actualTitle=savedDone.at(-1)?.title||(whoopDone.length?whoopWorkoutName(whoopDone.at(-1)):logged.length?p.title+' · LOGGED':p.title);
 $('drawerDate').textContent=dateLabel(selected).toUpperCase();
 $('drawerWorkout').textContent=actualTitle;
 $('drawerFocus').textContent=finished?'COMPLETED WORKOUT · ACTUAL TRAINING HISTORY':p.focus;
 renderDailySquatWorkout($('dailySquatDrawer'),selected);
 $('drawerWorkoutResult').classList.toggle('hidden',!finished);
 $('drawerPlannedSection').classList.toggle('hidden',finished);
 $('drawerScheduleEditBar').classList.toggle('hidden',finished);
 if(finished)$('drawerPlanEditor').classList.add('hidden');
 $('drawerResultHeading').textContent=actualTitle;
 $('drawerResultInfo').textContent=whoopDone.length+' WHOOP ACTIVIT'+(whoopDone.length===1?'Y':'IES')+' · '+savedDone.length+' SAVED SESSION'+(savedDone.length===1?'':'S')+' · '+logged.reduce((n,e)=>n+sets(e).length,0)+' LOGGED SETS';
 $('drawerLoggedHeader').classList.toggle('hidden',!logged.length);
 const plannedDone=p.ex.filter(([ex])=>doneNames.has(ex)).length;
 $('drawerCount').textContent=plannedDone+' OF '+p.ex.length+' PLANNED EXERCISES LOGGED';
 $('drawerMeterFill').style.width=(p.ex.length?plannedDone/p.ex.length*100:0)+'%';
 const r=recovery();
 $('drawerGuidance').textContent=r===null?'':'See the single recovery guidance card in Calendar.';
 $('drawerClearDay').classList.toggle('hidden',!logged.length);
 $('drawerClearDay').onclick=()=>deleteDayLogs(date);
 const list=$('drawerExercises');list.replaceChildren();
 p.ex.forEach(([exercise,prescription,targetWeight],i)=>{
  const row=el('div','drawer-exercise');
  const number=el('span','drawer-exercise-num',String(i+1).padStart(2,'0'));
  const desc=el('div','');desc.append(el('strong','',exercise),el('small','',prescription+(targetWeight!==undefined&&targetWeight!==''?' · Target '+targetWeight+' lb':'')));
  row.append(number,desc);list.append(row);
 });
 renderWhoopDay($('drawerWhoopActivities'),date);
 renderCompletedForDate($('drawerCompletedWorkouts'),date);
 const past=$('drawerLogged');past.replaceChildren();
 if(!logged.length&&!finished)past.append(el('p','muted','No exercises recorded yet. Tap LOG SETS above to add your workout.'));
 else logged.forEach(e=>{
  const row=el('div','drawer-exercise'),desc=el('div','');
  desc.append(el('strong','',e.exercise),el('small','',sets(e).map(x=>(x.warmup?'WARMUP ':'')+x.weight+' lb × '+x.reps).join(' · ')));
  const buttons=el('div','log-actions');
  const edit=el('button','smallbtn','EDIT');edit.type='button';edit.onclick=()=>openEditLog(e.id);
  const del=el('button','smallbtn','DELETE');del.type='button';del.onclick=()=>deleteLoggedExercise(e.id);
  buttons.append(edit,del);row.append(desc,buttons);past.append(row);
 });
}
$('drawerClose').onclick=closeDayDrawer;$('drawerDone').onclick=closeDayDrawer;
$('dayDrawerOverlay').addEventListener('click',e=>{if(e.target===$('dayDrawerOverlay'))closeDayDrawer()});
$('drawerAddCustom').onclick=()=>openLog(selected,'');

function renderAll(){renderCalendar();renderSquatTracker();renderSelected();renderAnalytics();renderDayDrawer();window.dispatchEvent(new Event('reptrack-workouts-changed'))}
window.RepTrackLogSessionSet=(date,exercise,weight,reps,sessionId,warmup=false)=>{
 if(!/^\d{4}-\d\d-\d\d$/.test(date)||!exercise||!Number.isFinite(+weight)||+weight<0||!Number.isInteger(+reps)||+reps<1)return false;
 const id=String(sessionId||'').slice(0,80),existing=entries.find(e=>e.date===date&&e.exercise===exercise&&e.sessionId===id);
 const set={weight:+weight,reps:+reps,warmup:!!warmup};
 if(existing){existing.sets.push(set)}
 else entries.push({id:Date.now()+'-'+Math.random().toString(36).slice(2),created:Date.now(),date,exercise:String(exercise).slice(0,100),sets:[set],sessionId:id,notes:''});
 if(!save())return false;
 renderAll();return true;
};
window.RepTrackSessionSetCount=(sessionId)=>entries.filter(e=>e.sessionId===sessionId).reduce((n,e)=>n+sets(e).length,0);

function renumberSetCards(){
 const cards=[...$('setsList').children];
 cards.forEach((card,i)=>{const label=card.querySelector('.set-position');if(label)label.textContent='SET '+(i+1)});
 $('setCountLabel').textContent=cards.length+' SET'+(cards.length===1?'':'S');
}
function logIndividualSet(row){
 const exercise=$('logExercise').value.trim(),date=$('logDate').value;
 const weightInput=row.querySelector('[data-set-weight]'),repsInput=row.querySelector('[data-set-reps]');
 if(!exercise||!date||!weightInput?.value.trim()||!repsInput?.value.trim()){alert('Enter an exercise, date, weight and reps first.');return}
 const weight=Number(weightInput.value),reps=Number(repsInput.value);
 if(!Number.isFinite(weight)||weight<0||!Number.isInteger(reps)||reps<1){alert('Enter valid set weights and reps.');return}
 row.dataset.committed='true';
 const current=entries.find(x=>x.id===editingLogId);
 const recorded=[...$('setsList').children].filter(x=>x.dataset.committed==='true').map(x=>({
  weight:Number(x.querySelector('[data-set-weight]').value),
  reps:Number(x.querySelector('[data-set-reps]').value),
  warmup:x.querySelector('.set-type').value==='warmup'
 }));
 if(recorded.some(x=>!Number.isFinite(x.weight)||x.weight<0||!Number.isInteger(x.reps)||x.reps<1)){alert('Check previously logged set values.');return}
 const item=current?{...current,date,exercise:exercise.slice(0,100),sets:recorded,notes:$('logNotes').value.slice(0,1000)}:{
  id:Date.now()+'-'+Math.random().toString(36).slice(2),created:Date.now(),date,exercise:exercise.slice(0,100),sets:recorded,notes:$('logNotes').value.slice(0,1000)
 };
 const previous=entries;
 entries=current?entries.map(e=>e.id===current.id?item:e):entries.concat(item);
 if(!save()){entries=previous;row.dataset.committed='false';return}
 editingLogId=item.id;
 row.classList.add('set-completed');
 const done=row.querySelector('.set-complete-btn');if(done)done.textContent='✓ LOGGED';
 selected=fromISO(date);month=new Date(selected.getFullYear(),selected.getMonth(),1);
 renderAll();startRestTimer();
}

function addSet(weight='',reps='',warmup=false){
 const row=el('div','setline set-card'),top=el('div','set-card-top'),number=el('span','set-position','');
 const type=el('select','set-type'),complete=el('button','set-complete-btn','✓ LOG SET'),remove=el('button','set-delete','×'),fields=el('div','set-card-fields');
 for(const [value,label] of [['warmup','WARMUP'],['working','WORKING']]){
  const option=el('option','',label);option.value=value;type.append(option);
 }
 type.value=warmup?'warmup':'working';type.setAttribute('aria-label','Warmup or working set');
 remove.type='button';remove.title='Remove set';remove.setAttribute('aria-label','Remove this set');
 remove.onclick=()=>{row.remove();renumberSetCards()};
 complete.type='button';complete.setAttribute('aria-label','Log this set and start the rest timer');complete.onclick=()=>logIndividualSet(row);
 top.append(number,type,complete,remove);
 for(const [caption,value,kind] of [['WEIGHT / LB',weight,'weight'],['REPS',reps,'reps']]){
  const label=el('label','set-input-label'),span=el('span','',caption),input=el('input','');
  input.type='number';input.required=true;input.value=value;input.inputMode=kind==='weight'?'decimal':'numeric';
  input.min=kind==='weight'?'0':'1';input.step=kind==='weight'?'0.5':'1';
  input.placeholder=kind==='weight'?'Enter lbs':'Enter reps';input.dataset[kind==='weight'?'setWeight':'setReps']='';
  label.append(span,input);fields.append(label);
 }
 row.append(top,fields);$('setsList').append(row);renumberSetCards();
}
function openLog(date,exercise){
editingLogId=null;
$('setEditorHint').textContent='Edit each set below. Warmups are saved separately from working sets.';
modalDate=iso(date);$('logDate').value=modalDate;$('logExercise').value=exercise;$('logNotes').value='';$('setsList').replaceChildren();
let prev=entries.filter(e=>window.RepTrackExerciseLibrary?.canonical(e.exercise)===window.RepTrackExerciseLibrary?.canonical(exercise)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
const planned=planFor(date).ex.find(x=>x[0]===exercise);
const target=planned?.[2];
const explicit=target!==''&&target!==undefined&&target!==null&&Number.isFinite(Number(target));
const squatWeek=squatMonth.some(x=>x.wednesday===iso(date)||x.sunday===iso(date));
const expSquat=exercise==='Back Squat'?experimentPrescription(date):null;
if(exercise==='Back Squat'){
 // User's daily squat warmups: bar 45 × 4 then 135 × 8, before exactly two working sets.
 addSet(45,4,true);
 addSet(135,8,true);
 const workingWeight=expSquat?.weight??(explicit?target:'');
 const workingReps=expSquat?.reps||(expSquat?expSquat.percentage>=70?5:expSquat.percentage>=60?6:8:6);
 addSet(workingWeight,workingReps,false);
 addSet(workingWeight,workingReps,false);
 $('setEditorHint').textContent='Daily Back Squat: 45 × 4 and 135 × 8 warmups, then 2 working sets. Change any weight or reps as needed.';
}else if(squatWeek&&explicit&&exercise==='Heel-Elevated Squat'){
 const repTarget=exercise==='Heel-Elevated Squat'?10:(date.getDay()===3?6:8);
 const scheduled=squatMonth.find(w=>w.wednesday===iso(date)||w.sunday===iso(date));
 for(let i=0;i<(scheduled?.light&&exercise==='Back Squat'?2:3);i++)addSet(target,repTarget);
}else if(prev?.sets?.length){
 const last=prev.sets.filter(x=>!x.warmup).at(-1)||prev.sets.at(-1);
 for(let i=0;i<3;i++)addSet(last.weight,last.reps,false);
}else {const weight=explicit?target:'';addSet(weight);addSet(weight);addSet(weight);}
$('modalTitle').textContent='LOG WORKOUT';$('modalOverlay').classList.remove('hidden');document.body.style.overflow='hidden';$('logExercise').focus();
}
function openEditLog(id){
 const item=entries.find(e=>e.id===id);
 if(!item)return;
 editingLogId=id;
 $('setEditorHint').textContent='Adjust individual weights, reps or set type. Use + Add Set to insert another.';
 modalDate=item.date;
 $('logDate').value=item.date;
 $('logExercise').value=item.exercise;
 $('logNotes').value=item.notes||'';
 $('setsList').replaceChildren();
 for(const s of item.sets){addSet(s.weight,s.reps,!!s.warmup);const row=$('setsList').lastElementChild;row.dataset.committed='true';row.classList.add('set-completed');row.querySelector('.set-complete-btn').textContent='✓ LOGGED'}
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
ev.preventDefault();const exercise=window.RepTrackExerciseLibrary.canonical($('logExercise').value.trim()),date=$('logDate').value;
const rows=[...$('setsList').children].map(row=>({weight:Number(row.querySelector('[data-set-weight]').value),reps:Number(row.querySelector('[data-set-reps]').value),warmup:row.querySelector('.set-type').value==='warmup'}));
if(!exercise||!date||!rows.length||rows.some(s=>!Number.isFinite(s.weight)||s.weight<0||!Number.isInteger(s.reps)||s.reps<1)){alert('Add at least one valid set and check the exercise, date, weight and reps.');return}
const item={id:Date.now()+'-'+Math.random().toString(36).slice(2),created:Date.now(),date,exercise:exercise.slice(0,100),sets:rows,notes:$('logNotes').value.slice(0,1000)};
const previous=entries.slice(),editedIndex=editingLogId?entries.findIndex(e=>e.id===editingLogId):-1;
if(editingLogId&&editedIndex===-1){alert('The original workout entry is no longer available.');return}
if(editedIndex>=0)entries[editedIndex]={...entries[editedIndex],date:item.date,exercise:item.exercise,sets:item.sets,notes:item.notes};
else entries.push(item);
if(save()){selected=fromISO(date);month=new Date(selected.getFullYear(),selected.getMonth(),1);editingLogId=null;closeLog();renderAll();startRestTimer()}
else entries=previous;
});
$('logExercise').addEventListener('change',()=>{
 if(editingLogId||$('modalOverlay').classList.contains('hidden'))return;
 if([...$('setsList').children].some(row=>row.dataset.committed==='true'))return;
 const name=$('logExercise').value.trim(),date=fromISO($('logDate').value||iso(selected));
 if(name)openLog(date,window.RepTrackExerciseLibrary.canonical(name));
});
$('addSet').onclick=()=>addSet('', '', false);
$('addSameSet').onclick=()=>{
 const previous=$('setsList').lastElementChild;
 if(!previous){addSet();return}
 const weight=previous.querySelector('[data-set-weight]')?.value||'';
 const reps=previous.querySelector('[data-set-reps]')?.value||'';
 const warmup=previous.querySelector('.set-type')?.value==='warmup';
 addSet(weight,reps,warmup);
};$('closeModal').onclick=closeLog;$('cancelModal').onclick=closeLog;
$('modalOverlay').addEventListener('click',e=>{if(e.target===$('modalOverlay'))closeLog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modalOverlay').classList.contains('hidden'))closeLog();else if(drawerOpen)closeDayDrawer()}});
$('prevMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderCalendar()};
$('nextMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderCalendar()};
$('todayButton').onclick=()=>{selected=new Date();month=new Date(selected.getFullYear(),selected.getMonth(),1);renderAll()};
$('exerciseSelect').onchange=renderExerciseTrend;
$('disconnectButton').onclick=async()=>{if(!confirm('Disconnect WHOOP from this browser?'))return;try{const response=await fetch('/api/whoop/logout',{method:'POST',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('The server could not disconnect WHOOP.');whoop={connected:false};whoopState='disconnected';renderWHOOP();renderCalendar();renderSelected();renderDayDrawer()}catch(e){whoopState='error';whoopError='Disconnect request failed. Try again.';renderWHOOP()}};
const LAST_BACKUP_KEY='reptrack-last-backup-v1';
function renderBackupAge(){
 const raw=Number(localStorage.getItem(LAST_BACKUP_KEY)||0),days=raw>0?Math.max(0,Math.floor((Date.now()-raw)/86400000)):null;
 const label=days===null?'Last backup: Never':days===0?'Last backup: Today':'Last backup: '+days+' day'+(days===1?'':'s')+' ago';
 $('backupAge').textContent=label+(days===null||days>=7?' · Export recommended':'');
 $('backupAge').classList.toggle('backup-warning',days===null||days>=7);
}
const backupKeys={personalPlan:'reptrack-personal-plan-v1',experiment:EXPERIMENT_KEY,completedSessions:COMPLETED_KEY,dayPlans:PLAN_KEY,weeklyPlans:WEEK_KEY};
function readBackupValue(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function backupRecordValid(e){
 if(!valid(e)||e.id.length>160||e.exercise.length>100||e.sets.length>200||!e.exercise.trim())return false;
 if(e.notes!==undefined&&(typeof e.notes!=='string'||e.notes.length>1000))return false;
 const date=fromISO(e.date);if(Number.isNaN(date.getTime())||iso(date)!==e.date)return false;
 return e.sets.every(v=>v&&Number.isFinite(Number(v.weight))&&Number(v.weight)>=0&&Number(v.weight)<=100000&&Number.isInteger(Number(v.reps))&&Number(v.reps)>=1&&Number(v.reps)<=1000&&(v.warmup===undefined||typeof v.warmup==='boolean'));
}
$('backupButton').onclick=()=>{
 const payload={format:'reptrack-backup',version:2,exportedAt:new Date().toISOString(),workouts:entries,completedSessions:readBackupValue(COMPLETED_KEY,[]),dayPlans:datePlans,weeklyPlans:weeklyPlans,experiment:readBackupValue(EXPERIMENT_KEY,null),personalPlan:readBackupValue('reptrack-personal-plan-v1',null)};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');
 a.href=url;a.download='reptrack-backup-'+iso(new Date())+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 try{localStorage.setItem(LAST_BACKUP_KEY,String(Date.now()))}catch{}
 renderBackupAge();
};
$('restoreInput').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('File is too large (maximum 5 MB).');
  const parsed=JSON.parse(await file.text());
  const legacy=Array.isArray(parsed),data=legacy?{workouts:parsed}:parsed;
  if(!data||typeof data!=='object'||(!legacy&&(data.format!=='reptrack-backup'||data.version!==2)))throw Error('Not a supported RepTrack backup.');
  if(!Array.isArray(data.workouts)||data.workouts.length>20000||!data.workouts.every(backupRecordValid))throw Error('Invalid exercise records or set weights/reps.');
  const idsInFile=new Set();for(const log of data.workouts){if(idsInFile.has(log.id))throw Error('Duplicate IDs in backup.');idsInFile.add(log.id)}
  if(!legacy){
   if(!Array.isArray(data.completedSessions)||data.completedSessions.length>10000||!data.completedSessions.every(x=>x&&typeof x.id==='string'&&x.id.length<=160&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&typeof x.title==='string'&&x.title.length<=100))throw Error('Invalid saved sessions.');
   if(![data.dayPlans,data.weeklyPlans].every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.values(x).every(validPlan)))throw Error('Invalid calendar plans.');
   if(data.personalPlan!==null&&data.personalPlan!==undefined&&(!Array.isArray(data.personalPlan.dailySquats)||data.personalPlan.dailySquats.length!==30||!data.personalPlan.dailySquats.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isInteger))))throw Error('Invalid personal plan.');
  }
  const ids=new Set(entries.map(e=>e.id)),additional=data.workouts.filter(x=>!ids.has(x.id));
  if(!confirm('Validated backup: '+data.workouts.length+' exercise records. Merge '+additional.length+' new records? Your current data will not be replaced.'))return;
  const prior=entries;entries=entries.concat(additional);
  if(!save()){entries=prior;throw Error('Your browser could not save the restored records.')}
  if(!legacy){
   const existing=completedSessions(),sessions=new Set(existing.map(x=>x.id));
   try{localStorage.setItem(COMPLETED_KEY,JSON.stringify([...existing,...data.completedSessions.filter(x=>!sessions.has(x.id))]))}catch{}
   for(const [field,key] of Object.entries({dayPlans:PLAN_KEY,weeklyPlans:WEEK_KEY,personalPlan:'reptrack-personal-plan-v1',experiment:EXPERIMENT_KEY})){
    const value=data[field];
    if(value!=null&&localStorage.getItem(key)===null){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
   }
   datePlans=readPlanStore(PLAN_KEY);weeklyPlans=readPlanStore(WEEK_KEY);
  }
  renderAll();
  window.dispatchEvent(new Event('reptrack-workouts-changed'));
 }catch(err){alert('Backup not restored: '+(err?.message||'Invalid file'))}
 finally{ev.target.value=''}
});
renderBackupAge();
let restDeadline=0,restPaused=seconds,restSounded=false;
function restAlarm(){
 if(restSounded)return;restSounded=true;
 try{if(navigator.vibrate)navigator.vibrate([120,80,120])}catch{}
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(Audio){const ctx=new Audio(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=750;gain.gain.setValueAtTime(.12,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.24);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.25);osc.onended=()=>ctx.close()}
 }catch{}
}
function paintTimer(){
 if(restDeadline){
  remaining=Math.max(0,Math.ceil((restDeadline-Date.now())/1000));
  if(remaining===0){restDeadline=0;restPaused=0;clearInterval(timer);timer=null;restAlarm()}
 }else remaining=restPaused;
 $('clock').textContent=pad(Math.floor(remaining/60))+':'+pad(remaining%60);
 $('timerStart').textContent=restDeadline?'PAUSE':'START';
 $('restTimerStatus').textContent=restDeadline?'REST IN PROGRESS':restSounded?'REST COMPLETE':'REST TIMER READY';
 $('modalRestStatus').textContent=restDeadline?'REST · '+$('clock').textContent:restSounded?'REST COMPLETE · NEXT SET':'REST TIMER · READY';
}
function stopTimerInterval(){if(timer){clearInterval(timer);timer=null}}
function startRestTimer(){
 stopTimerInterval();restPaused=seconds;remaining=seconds;restSounded=false;
 restDeadline=Date.now()+seconds*1000;
 timer=setInterval(paintTimer,250);paintTimer();
}
$('timerStart').onclick=()=>{
 if(restDeadline){restPaused=Math.max(0,Math.ceil((restDeadline-Date.now())/1000));restDeadline=0;stopTimerInterval();paintTimer();return}
 if(restPaused<=0)restPaused=seconds;
 stopTimerInterval();restSounded=false;restDeadline=Date.now()+restPaused*1000;
 timer=setInterval(paintTimer,250);paintTimer();
};
$('timerReset').onclick=()=>{stopTimerInterval();restDeadline=0;restPaused=seconds;restSounded=false;paintTimer()};
document.querySelectorAll('[data-timer]').forEach(b=>b.onclick=()=>{const active=!!restDeadline;seconds=Number(b.dataset.timer);restPaused=seconds;if(active)startRestTimer();else paintTimer()});
document.addEventListener('visibilitychange',paintTimer);
window.addEventListener('focus',paintTimer);
const navButtons=[...document.querySelectorAll('[data-view]')];
const ROUTES=['calendar','analytics','overload','workout','experiments'];
const normalizeRoute=hash=>{const value=String(hash||'').replace(/^#/,'').toLowerCase();return value==='whoop'?'workout':ROUTES.includes(value)?value:'calendar'};
function switchView(view,{history=true,scroll=true}={}){
 const route=normalizeRoute(view);
 for(const b of navButtons){b.classList.toggle('active',b.dataset.view===route);if(b.dataset.view===route)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')}
 for(const e of document.querySelectorAll('[data-page]'))e.classList.toggle('hidden',e.dataset.page!==route);
 const routeHash=route==='workout'?'#whoop':'#'+route;
 if(history&&location.hash!==routeHash)window.history.pushState({view:route},'',routeHash);
 if(scroll)window.scrollTo(0,0);
}
navButtons.forEach(b=>b.onclick=()=>switchView(b.dataset.view));
const syncRouteFromURL=()=>switchView(normalizeRoute(location.hash),{history:false});
window.addEventListener('hashchange',syncRouteFromURL);
window.addEventListener('popstate',syncRouteFromURL);
syncRouteFromURL();
window.addEventListener('storage',e=>{if(e.key===KEY){load();renderAll()}else if(e.key===COMPLETED_KEY){renderAll()}else if(e.key===PLAN_KEY||e.key===WEEK_KEY){datePlans=readPlanStore(PLAN_KEY);weeklyPlans=readPlanStore(WEEK_KEY);renderAll();window.dispatchEvent(new Event('reptrack-plan-changed'))}else if(e.key===EXPERIMENT_KEY){updateExperimentState()}});
load();renderAll();paintTimer();syncWHOOP(true);
// Poll whenever the app is in the foreground. WHOOP's API may not update every minute.
setInterval(()=>{if(!document.hidden)syncWHOOP()},60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncWHOOP()});
window.addEventListener('focus',()=>syncWHOOP());
window.addEventListener('reptrack-whoop-manual-refresh',()=>{
 whoop=window.RepTrackWHOOPData;
 lastWhoopSuccess=window.RepTrackWHOOPLastSync||Date.now();
 whoopState=whoop?.connected?'connected':'disconnected';
 lastWhoopSyncAttempt=lastWhoopSuccess;
 renderWHOOP();renderCalendar();renderSelected();renderDayDrawer();
});
window.addEventListener('online',()=>syncWHOOP(true));
})();