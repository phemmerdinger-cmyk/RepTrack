(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='reptrack-live-session-v1',LOG='reptrack-workouts-v1',HISTORY='reptrack-sessions-v1';
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const pad=n=>String(Math.floor(n)).padStart(2,'0');
const formatDuration=seconds=>pad(seconds/3600)+':'+pad(seconds%3600/60)+':'+pad(seconds%60);
const fmt=n=>Math.round(n).toLocaleString('en-US');
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const readJSON=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v===null?fallback:v}catch{return fallback}};
const readLogs=()=>{const a=readJSON(LOG,[]);return Array.isArray(a)?a:[]};
let session=readJSON(KEY,null),restDuration=120,restEnds=0,restPaused=120,restTimer=null;
const valid=s=>s&&typeof s.id==='string'&&typeof s.started==='number'&&typeof s.date==='string'&&typeof s.title==='string'&&Array.isArray(s.ex)&&s.ex.length<=50;
if(!valid(session))session=null;
const elapsed=()=>session?Math.max(0,Math.floor(((session.pausedAt||Date.now())-session.started-session.pausedMs)/1000)):0;
const write=()=>{try{if(session)localStorage.setItem(KEY,JSON.stringify(session));else localStorage.removeItem(KEY);return true}catch{alert('Your phone storage is full or unavailable. Please export your workout records.');return false}};
const activeRecords=()=>{
 if(!session)return [];
 const stored=Array.isArray(session.logs)?session.logs:[];
 const legacy=readLogs().filter(x=>x.sessionId===session.id);
 // An exercise edited in the draft supersedes any legacy log for that exercise.
 return [...stored,...legacy.filter(x=>!stored.some(e=>e.exercise===x.exercise))];
};
const saveDraftSet=(name,weight,reps,warmup)=>{
 if(!session)return false;
 const previous=JSON.stringify(session.logs||[]);
 if(!Array.isArray(session.logs))session.logs=[];
 let record=session.logs.find(x=>x.exercise===name);
 if(!record){
  const legacy=readLogs().filter(x=>x.sessionId===session.id&&x.exercise===name);
  record={exercise:name,sets:legacy.flatMap(x=>x.sets||[])};
  session.logs.push(record);
 }
 record.sets.push({weight,reps,warmup});
 if(!write()){session.logs=JSON.parse(previous);return false}
 return true;
};
const editDraftSet=(name)=>{
 if(!session)return;
 if(!Array.isArray(session.logs))session.logs=[];
 const logged=activeRecords().filter(x=>x.exercise===name);
 const old=session.logs.map(x=>({...x,sets:x.sets.map(v=>({...v}))}));
 let record=session.logs.find(x=>x.exercise===name);
 if(!record){record={exercise:name,sets:logged.flatMap(x=>x.sets||[]).map(v=>({...v}))};session.logs.push(record)}
 const updates=[];
 for(const item of record.sets){
  const label='Set '+(updates.length+1)+' · '+(item.warmup?'WARMUP':'WORKING');
  const weight=prompt(label+' — weight (lb), blank to DELETE this set',String(item.weight));
  if(weight===null)return;
  if(weight.trim()==='')continue;
  const reps=prompt(label+' — reps',String(item.reps));
  if(reps===null)return;
  const amount=Number(weight),count=Number(reps);
  if(!Number.isFinite(amount)||amount<0||!Number.isInteger(count)||count<1){alert('Enter a valid weight and rep count.');return}
  updates.push({weight:amount,reps:count,warmup:item.warmup});
 }
 record.sets=updates;
 if(!record.sets.length)session.logs=session.logs.filter(x=>x!==record);
 if(!write()){session.logs=old;return}
 render();
};
const removeDraftExercise=name=>{
 if(!session||!confirm('Remove all '+name+' sets from this in-progress workout?'))return;
 if(!Array.isArray(session.logs))session.logs=[];
 const old=session.logs.map(x=>({...x,sets:x.sets.map(v=>({...v}))}));
 // Empty set list shadows legacy sets from old app versions.
 session.logs=session.logs.filter(e=>e.exercise!==name);
 session.logs.push({exercise:name,sets:[]});
 if(!write()){session.logs=old;return}
 render();
};
const recordSets=()=>activeRecords().reduce((sum,r)=>sum+(Array.isArray(r.sets)?r.sets.length:0),0);
const recordVolume=()=>activeRecords().reduce((sum,r)=>sum+(Array.isArray(r.sets)?r.sets.reduce((a,s)=>a+(+s.weight||0)*(+s.reps||0),0):0),0);
const priorRecord=name=>readLogs().filter(e=>e.exercise===name&&Array.isArray(e.sets)&&e.sessionId!==session?.id).sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0)).at(-1);
const recordFor=name=>activeRecords().find(e=>e.exercise===name);
const pickDate=()=>typeof window.RepTrackSelectedDate==='function'?window.RepTrackSelectedDate():iso(new Date());
let selection='scheduled',previewDate=null;
function showPage(){document.querySelector('[data-view="workout"]')?.click()}
function chosenPlan(date){
 if(selection==='scheduled')return window.RepTrackPlanForDate?.(date);
 const p=window.RepTrackWorkoutPreset?.(selection);
 return window.RepTrackApplyExperiments?.(p,date)||p;
}
function showPreview(){
 const date=previewDate||pickDate(),p=chosenPlan(date)||{title:'WORKOUT',focus:'Your session',ex:[]};
 $('preWorkoutSelect').value=selection;
 $('idleWorkoutDate').textContent=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}).toUpperCase();
 $('idleWorkoutTitle').textContent=p.title;$('idleWorkoutFocus').textContent=p.focus;
 const container=$('idleWorkoutExercises');container.replaceChildren();
 for(const [name,target,weight] of (p.ex||[]).slice(0,12)){
  const row=el('div','workout-preview-row');
  row.append(el('strong','',name),el('span','',target+(weight!==''&&weight!=null?' · '+weight+' lb':'')));
  container.append(row);
 }
 if(!p.ex?.length)container.append(el('p','muted',selection==='CUSTOM'?'Start with an empty workout, then add exercises and sets as you train.':'No exercises in this schedule.'));
}
function prepareWorkout(date=pickDate()){
 if(session){showPage();render();return}
 previewDate=date;selection='scheduled';showPage();render();
}
function start(date=previewDate||pickDate()){
 if(session){showPage();render();return}
 const plan=chosenPlan(date);
 if(!plan||!Array.isArray(plan.ex))return alert('Choose a workout to start.');
 const now=new Date();
 session={id:'session-'+Date.now()+'-'+Math.random().toString(36).slice(2),date:iso(now),sourceDate:date,title:plan.title,focus:plan.focus,ex:plan.ex.map(x=>[x[0],x[1],x[2]??'']),started:Date.now(),pausedAt:0,pausedMs:0,logs:[]};
 if(!write()){session=null;return}
 showPage();render();
}
let decisionPausedByFinish=false;
function finish(){
 if(!session)return;
 if(!session.pausedAt){session.pausedAt=Date.now();decisionPausedByFinish=true;write()}
 else decisionPausedByFinish=false;
 const total=recordSets(),volume=recordVolume(),duration=elapsed();
 $('workoutDecisionSummary').textContent=session.title+' · '+session.date+' · '+total+' sets · '+fmt(volume)+' lb-reps · '+formatDuration(duration)+'.';
 $('workoutActive').classList.add('hidden');
 $('workoutDecision').classList.remove('hidden');
 $('workoutComplete').classList.add('hidden');
 $('workoutSave').focus();
}
function keepGoing(){
 if(!session)return;
 if(decisionPausedByFinish&&session.pausedAt){session.pausedMs+=Date.now()-session.pausedAt;session.pausedAt=0;write()}
 decisionPausedByFinish=false;
 $('workoutDecision').classList.add('hidden');
 render();
}
function saveWorkout(){
 if(!session)return;
 const total=recordSets(),volume=recordVolume(),duration=elapsed(),stamp=session.date;
 if(total===0&&!confirm('Save this workout with no logged sets?'))return;
 const summary={id:session.id,date:stamp,title:session.title,started:session.started,ended:Date.now(),duration,sets:total,volume};
 if(!window.RepTrackSaveCompletedSession?.(summary,activeRecords().filter(x=>x.sets?.length))){
  alert('Could not save your workout. It is still available as a draft in Workout Mode.');return;
 }
 session=null;write();clearRest();decisionPausedByFinish=false;
 $('workoutDecision').classList.add('hidden');
 $('workoutSummary').textContent=total+' sets · '+fmt(volume)+' lb-reps · '+formatDuration(duration)+'. Saved in your calendar.';
 render();
 document.querySelector('[data-view="calendar"]')?.click();
 const tile=[...document.querySelectorAll('#monthGrid .day')].find(x=>x.dataset.date===stamp);
 tile?.click();
}
function discardWorkout(){
 if(!session)return;
 if(!confirm('Discard this workout? Its unsaved sets will be permanently deleted. Previously saved workouts are safe.'))return;
 const id=session.id;
 window.RepTrackDiscardDraftSession?.(id);
 session=null;write();clearRest();decisionPausedByFinish=false;
 $('workoutDecision').classList.add('hidden');
 $('workoutComplete').classList.add('hidden');
 render();
}
function setPause(){
 if(!session)return;
 if(session.pausedAt){session.pausedMs+=Date.now()-session.pausedAt;session.pausedAt=0}
 else session.pausedAt=Date.now();
 write();render();
}
function renderMetric(){
 const whoop=window.RepTrackWHOOPData;
 const recovery=$('recoveryMetric')?.textContent?.trim()||'—',strain=$('strainMetric')?.textContent?.trim()||'—',sleep=$('sleepMetric')?.textContent?.trim()||'—';
 const readNum=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
 const stat=(id,val,unit='')=>{const x=readNum(val);$(id).textContent=x===null?'—':Math.round(x)+(unit||'')};
 $('workoutRecovery').textContent=recovery;
 $('workoutStrain').textContent=strain;
 $('workoutStrainLarge').textContent=strain;
 $('workoutRecovery').className=recovery==='—'?'':$('recoveryMetric')?.className?.replace('metric ','')||'';
 const strainValue=readNum(whoop?.cycle?.score?.strain);
 $('workoutStrainProgress').style.width=(strainValue===null?0:Math.min(100,Math.max(0,strainValue/21*100)))+'%';
 stat('workoutDayAvgHr',whoop?.cycle?.score?.average_heart_rate);
 stat('workoutMaxHr',whoop?.cycle?.score?.max_heart_rate);
 stat('workoutRestingHr',whoop?.recovery?.score?.resting_heart_rate);
 stat('workoutHRV',whoop?.recovery?.score?.hrv_rmssd_milli);
 $('workoutSleep').textContent=sleep;
 const connected=!!whoop?.connected;
 $('workoutRecoveryLabel').textContent=connected?'WHOOP DAILY RECOVERY':'WHOOP NOT CONNECTED';
 const latest=Number(window.RepTrackWHOOPLastSync||0);
 const age=latest?Math.floor((Date.now()-latest)/60000):null;
 $('workoutDataAge').textContent=latest?'WHOOP CHECKED '+(age===0?'JUST NOW':age+' MIN AGO'):'WHOOP AWAITING DATA';
 $('workoutHeartRateStatus').textContent=connected?'CYCLE SUMMARY · NOT YOUR CURRENT HEARTBEAT':'NOT LIVE · CONNECT WHOOP FOR CYCLE DATA';
 const score=parseFloat(recovery);const guidance=!Number.isFinite(score)?'Use your energy and form to set your training intensity.':score>=67?'Recovery is high. Follow your training plan if you feel ready.':score>=34?'Moderate recovery. Consider keeping a few reps in reserve.':'Low recovery. Consider reducing intensity or taking a rest day.';
 $('workoutWhoopInsight').textContent=guidance+' Sleep performance: '+sleep+'.';
 $('workoutSyncStatus').textContent=connected?'WHOOP recovery, cycle strain and cycle heart-rate summaries are checked automatically about every minute while this app is open. They are not continuous heart-rate readings.':'Your lifting tracker works independently of WHOOP. Connect WHOOP under Analytics → Data & Connection.';
}
function updateClock(){
 if(!session)return;
 $('workoutElapsed').textContent=formatDuration(elapsed());
 $('workoutSets').textContent=recordSets();$('workoutVolume').textContent=fmt(recordVolume());
 const remaining=restEnds?Math.max(0,Math.ceil((restEnds-Date.now())/1000)):restPaused;
 if(restEnds&&remaining===0){restEnds=0;restPaused=0;if(navigator.vibrate)navigator.vibrate([100,80,100]);}
 $('workoutRestClock').textContent=pad(remaining/60)+':'+pad(remaining%60);
 $('workoutRestToggle').textContent=restEnds?'PAUSE REST':remaining===0?'RESTART REST':'START REST';
}
function clearRest(){restEnds=0;restPaused=restDuration}
function restToggle(){
 if(restEnds){restPaused=Math.max(0,Math.ceil((restEnds-Date.now())/1000));restEnds=0}
 else{if(restPaused<=0)restPaused=restDuration;restEnds=Date.now()+restPaused*1000}
 updateClock();
}
function exerciseCard(ex,index){
 const [name,target,weight]=ex,container=el('article','live-exercise'),top=el('div','live-exercise-head'),info=el('div'),count=recordFor(name)?.sets?.length||0;
 info.append(el('span','micro','EXERCISE '+String(index+1).padStart(2,'0')),el('h3','',name));
 const detail=el('div','muted',(target||'Custom sets')+(weight!==''&&weight!=null?' · Target '+weight+' lb':''));
 info.append(detail);top.append(info,el('span','session-set-count',count+' SET'+(count===1?'':'S')+' DONE'));container.append(top);
 const prior=priorRecord(name),logged=recordFor(name);
 if(prior?.sets?.length){const s=prior.sets.at(-1);container.append(el('div','live-last-set','PREVIOUS SESSION · '+s.weight+' LB × '+s.reps+' REPS'))}
 if(logged?.sets?.length){
 const history=el('div','live-set-history');
 logged.sets.forEach((set,i)=>history.append(el('span',set.warmup?'warmup-history':'',String(i+1).padStart(2,'0')+'  '+set.weight+' lb × '+set.reps+(set.warmup?' · WARMUP':''))));
 container.append(history);
 const actions=el('div','live-edit-actions');
 const edit=el('button','','EDIT LOGGED SETS');edit.type='button';edit.onclick=()=>editDraftSet(name);
 const remove=el('button','','DELETE LOGGED EXERCISE');remove.type='button';remove.onclick=()=>removeDraftExercise(name);
 actions.append(edit,remove);container.append(actions);
 }
 const form=el('form','live-set-form'),weightField=el('label',''),repField=el('label',''),typeField=el('label',''),w=el('input'),r=el('input'),setType=el('select',''),button=el('button','btn-primary','✓ LOG SET');
 w.type='number';w.step='0.5';w.min='0';w.required=true;w.inputMode='decimal';w.placeholder='LB';w.setAttribute('aria-label','Weight in pounds');
 r.type='number';r.step='1';r.min='1';r.required=true;r.inputMode='numeric';r.placeholder='REPS';r.setAttribute('aria-label','Number of repetitions');
 const last=logged?.sets?.at(-1)||prior?.sets?.at(-1);
 const prescribed=weight!==''&&weight!=null&&Number.isFinite(+weight);
 w.value=last?.weight??(prescribed?weight:'');
 r.value=last?.reps??(/6–8/.test(target)?6:/8–10/.test(target)?8:/10–12/.test(target)?10:'');
 weightField.append(el('span','','WEIGHT / LB'),w);repField.append(el('span','','REPS'),r);
 for(const [value,label] of [['working','WORKING'],['warmup','WARMUP']]){const option=el('option','',label);option.value=value;setType.append(option)}
 setType.value=logged?.sets?.length?'working':'warmup';
 setType.addEventListener('change',()=>{button.textContent=setType.value==='warmup'?'✓ LOG WARMUP':'✓ LOG WORKING SET'});
 typeField.append(el('span','','SET TYPE'),setType);
 button.type='submit';form.append(weightField,repField,typeField,button);
 form.addEventListener('submit',ev=>{ev.preventDefault();if(!session)return;const amount=Number(w.value),reps=Number(r.value);if(!Number.isFinite(amount)||amount<0||!Number.isInteger(reps)||reps<1)return;
 const ok=saveDraftSet(name,amount,reps,setType.value==='warmup');
 if(ok){clearRest();restEnds=Date.now()+restDuration*1000;render();}});
 container.append(form);
 return container;
}
function render(){
 showPreview();
 $('workoutIdle').classList.toggle('hidden',!!session);
 $('workoutActive').classList.toggle('hidden',!session);
 if(!session)return;
 $('workoutComplete').classList.add('hidden');
 $('workoutDecision').classList.add('hidden');
 $('activeWorkoutName').textContent=session.title;
 $('activeWorkoutFocus').textContent=session.focus;
 $('activeWorkoutDate').textContent=new Date(session.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase()+(session.sourceDate!==session.date?' · PLAN FROM '+session.sourceDate:'');
 $('workoutPause').textContent=session.pausedAt?'RESUME TIMER':'PAUSE TIMER';
 const host=$('workoutExerciseList');host.replaceChildren();
 session.ex.forEach((item,i)=>host.append(exerciseCard(item,i)));
 renderMetric();updateClock();
}
$('preWorkoutSelect').addEventListener('change',e=>{selection=e.target.value;showPreview()});
$('workoutBegin').addEventListener('click',()=>start());
$('startSelectedWorkout').addEventListener('click',()=>prepareWorkout());
$('drawerStartWorkout').addEventListener('click',()=>{const date=pickDate();document.getElementById('drawerDone')?.click();prepareWorkout(date)});
$('workoutFinish').addEventListener('click',finish);
$('workoutSave').addEventListener('click',saveWorkout);
$('workoutDiscard').addEventListener('click',discardWorkout);
$('workoutKeepGoing').addEventListener('click',keepGoing);
$('workoutPause').addEventListener('click',setPause);
$('workoutRestToggle').addEventListener('click',restToggle);
$('workoutRestReset').addEventListener('click',()=>{clearRest();updateClock()});
document.querySelectorAll('[data-workout-rest]').forEach(b=>b.addEventListener('click',()=>{restDuration=Number(b.dataset.workoutRest);clearRest();updateClock()}));
$('workoutAddExercise').addEventListener('click',()=>{if(!session)return;const name=prompt('Exercise name');if(!name||!name.trim())return;const safe=name.trim().slice(0,100);if(session.ex.some(e=>e[0].toLowerCase()===safe.toLowerCase()))return alert('That exercise is already in your session.');session.ex.push([safe,'Custom sets','']);write();render()});
$('workoutCompleteClose').addEventListener('click',()=>{document.querySelector('[data-view="calendar"]')?.click();$('workoutComplete').classList.add('hidden')});
document.querySelectorAll('[data-view="workout"]').forEach(b=>b.addEventListener('click',render));
document.querySelectorAll('[data-view="calendar"]').forEach(b=>b.addEventListener('click',showPreview));
window.addEventListener('reptrack-plan-changed',showPreview);
window.addEventListener('reptrack-experiments-changed',()=>{if(!session)showPreview()});
window.addEventListener('reptrack-whoop-updated',renderMetric);
window.addEventListener('reptrack-workouts-changed',()=>{if(session)render()});
window.addEventListener('storage',e=>{if(e.key===KEY){const v=readJSON(KEY,null);session=valid(v)?v:null;render()}});
const metric=$('recoveryMetric');if(metric){new MutationObserver(renderMetric).observe(metric,{childList:true,subtree:true,characterData:true})}
const strain=$('strainMetric');if(strain){new MutationObserver(renderMetric).observe(strain,{childList:true,subtree:true,characterData:true})}
setInterval(()=>{if(session)updateClock()},1000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
render();
if(session&&location.hash==='#workout')showPage();
})();