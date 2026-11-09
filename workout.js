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
const activeRecords=()=>session?readLogs().filter(x=>x.sessionId===session.id):[];
const recordSets=()=>activeRecords().reduce((sum,r)=>sum+(Array.isArray(r.sets)?r.sets.length:0),0);
const recordVolume=()=>activeRecords().reduce((sum,r)=>sum+(Array.isArray(r.sets)?r.sets.reduce((a,s)=>a+(+s.weight||0)*(+s.reps||0),0):0),0);
const priorRecord=name=>readLogs().filter(e=>e.exercise===name&&Array.isArray(e.sets)&&e.sessionId!==session?.id).sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0)).at(-1);
const recordFor=name=>activeRecords().find(e=>e.exercise===name);
const pickDate=()=>typeof window.RepTrackSelectedDate==='function'?window.RepTrackSelectedDate():iso(new Date());
function showPage(){document.querySelector('[data-view="workout"]')?.click()}
function showPreview(){
 const date=pickDate(),p=window.RepTrackPlanForDate?.(date)||{title:'WORKOUT',focus:'Your session',ex:[]};
 $('idleWorkoutDate').textContent=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}).toUpperCase();
 $('idleWorkoutTitle').textContent=p.title;$('idleWorkoutFocus').textContent=p.focus;
}
function start(date=pickDate()){
 if(session){showPage();render();return}
 const plan=window.RepTrackPlanForDate?.(date);
 if(!plan||!Array.isArray(plan.ex))return alert('Open your calendar to select a workout.');
 const now=new Date();
 session={id:'session-'+Date.now()+'-'+Math.random().toString(36).slice(2),date:iso(now),sourceDate:date,title:plan.title,focus:plan.focus,ex:plan.ex.map(x=>[x[0],x[1],x[2]??'']),started:Date.now(),pausedAt:0,pausedMs:0};
 if(!write()){session=null;return}
 showPage();render();
}
function finish(){
 if(!session)return;
 if(!confirm('Finish this RepTrack workout? All logged sets will remain saved.'))return;
 const total=recordSets(),volume=recordVolume(),duration=elapsed();
 const summary={id:session.id,date:session.date,title:session.title,started:session.started,ended:Date.now(),duration,sets:total,volume};
 const prior=readJSON(HISTORY,[]);if(Array.isArray(prior)){try{localStorage.setItem(HISTORY,JSON.stringify([...prior.slice(-199),summary]))}catch{}}
 session=null;write();clearRest();
 $('workoutSummary').textContent=total+' sets · '+fmt(volume)+' lb-reps · '+formatDuration(duration)+'. Your saved sets are available in Calendar and Progressive Overload.';
 render();
 $('workoutComplete').classList.remove('hidden');
}
function setPause(){
 if(!session)return;
 if(session.pausedAt){session.pausedMs+=Date.now()-session.pausedAt;session.pausedAt=0}
 else session.pausedAt=Date.now();
 write();render();
}
function renderMetric(){
 const recovery=$('recoveryMetric')?.textContent?.trim()||'—',strain=$('strainMetric')?.textContent?.trim()||'—',sleep=$('sleepMetric')?.textContent?.trim()||'—';
 $('workoutRecovery').textContent=recovery;$('workoutStrain').textContent=strain;
 $('workoutRecovery').className=recovery==='—'?'':$('recoveryMetric')?.className?.replace('metric ','')||'';
 const connected=$('whoopBadge')?.textContent?.includes('CONNECTED');
 $('workoutRecoveryLabel').textContent=connected?'WHOOP RECOVERY':'WHOOP NOT CONNECTED';
 const score=parseFloat(recovery);const guidance=!Number.isFinite(score)?'Use your energy and form to set your training intensity.':score>=67?'Recovery is high. Follow your training plan if you feel ready.':score>=34?'Moderate recovery. Consider keeping a few reps in reserve.':'Low recovery. Consider reducing intensity or taking a rest day.';
 $('workoutWhoopInsight').textContent=guidance+' Sleep performance: '+sleep+'.';
 $('workoutSyncStatus').textContent=connected?'WHOOP recovery and day strain refresh when available, typically every 5 minutes while the app is open. This is not a live HR stream.':'Your RepTrack lifting session works independently. Reconnect WHOOP under Analytics → Data & Connection if needed.';
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
 logged.sets.forEach((set,i)=>history.append(el('span','',String(i+1).padStart(2,'0')+'  '+set.weight+' lb × '+set.reps)));
 container.append(history);
 }
 const form=el('form','live-set-form'),weightField=el('label',''),repField=el('label',''),w=el('input'),r=el('input'),button=el('button','btn-primary','✓ LOG SET');
 w.type='number';w.step='0.5';w.min='0';w.required=true;w.inputMode='decimal';w.placeholder='LB';w.setAttribute('aria-label','Weight in pounds');
 r.type='number';r.step='1';r.min='1';r.required=true;r.inputMode='numeric';r.placeholder='REPS';r.setAttribute('aria-label','Number of repetitions');
 const last=logged?.sets?.at(-1)||prior?.sets?.at(-1);
 const prescribed=weight!==''&&weight!=null&&Number.isFinite(+weight);
 w.value=last?.weight??(prescribed?weight:'');
 r.value=last?.reps??(/6–8/.test(target)?6:/8–10/.test(target)?8:/10–12/.test(target)?10:'');
 weightField.append(el('span','','WEIGHT / LB'),w);repField.append(el('span','','REPS'),r);
 button.type='submit';form.append(weightField,repField,button);
 form.addEventListener('submit',ev=>{ev.preventDefault();if(!session)return;const amount=Number(w.value),reps=Number(r.value);if(!Number.isFinite(amount)||amount<0||!Number.isInteger(reps)||reps<1)return;
 const ok=window.RepTrackLogSessionSet?.(session.date,name,amount,reps,session.id);
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
 $('activeWorkoutName').textContent=session.title;
 $('activeWorkoutFocus').textContent=session.focus;
 $('activeWorkoutDate').textContent=new Date(session.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase()+(session.sourceDate!==session.date?' · PLAN FROM '+session.sourceDate:'');
 $('workoutPause').textContent=session.pausedAt?'RESUME TIMER':'PAUSE TIMER';
 const host=$('workoutExerciseList');host.replaceChildren();
 session.ex.forEach((item,i)=>host.append(exerciseCard(item,i)));
 renderMetric();updateClock();
}
$('workoutBegin').addEventListener('click',()=>start());
$('startSelectedWorkout').addEventListener('click',()=>start());
$('drawerStartWorkout').addEventListener('click',()=>{document.getElementById('drawerDone')?.click();start()});
$('workoutFinish').addEventListener('click',finish);
$('workoutPause').addEventListener('click',setPause);
$('workoutRestToggle').addEventListener('click',restToggle);
$('workoutRestReset').addEventListener('click',()=>{clearRest();updateClock()});
document.querySelectorAll('[data-workout-rest]').forEach(b=>b.addEventListener('click',()=>{restDuration=Number(b.dataset.workoutRest);clearRest();updateClock()}));
$('workoutAddExercise').addEventListener('click',()=>{if(!session)return;const name=prompt('Exercise name');if(!name||!name.trim())return;const safe=name.trim().slice(0,100);if(session.ex.some(e=>e[0].toLowerCase()===safe.toLowerCase()))return alert('That exercise is already in your session.');session.ex.push([safe,'Custom sets','']);write();render()});
$('workoutCompleteClose').addEventListener('click',()=>{document.querySelector('[data-view="calendar"]')?.click();$('workoutComplete').classList.add('hidden')});
document.querySelectorAll('[data-view="workout"]').forEach(b=>b.addEventListener('click',render));
document.querySelectorAll('[data-view="calendar"]').forEach(b=>b.addEventListener('click',showPreview));
window.addEventListener('reptrack-plan-changed',showPreview);
window.addEventListener('reptrack-workouts-changed',()=>{if(session)updateClock()});
window.addEventListener('storage',e=>{if(e.key===KEY){const v=readJSON(KEY,null);session=valid(v)?v:null;render()}});
const metric=$('recoveryMetric');if(metric){new MutationObserver(renderMetric).observe(metric,{childList:true,subtree:true,characterData:true})}
const strain=$('strainMetric');if(strain){new MutationObserver(renderMetric).observe(strain,{childList:true,subtree:true,characterData:true})}
setInterval(()=>{if(session)updateClock()},1000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
render();
if(session&&location.hash==='#workout')showPage();
})();