(()=>{'use strict';
const $=id=>document.getElementById(id);
const catalog=window.RepTrackExerciseLibrary;
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const dayDate=s=>new Date(s+'T12:00:00');
const canon=name=>catalog?.canonical(name)||String(name||'').trim();
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const logs=()=>read('reptrack-workouts-v1',[]).filter(e=>e&&typeof e.exercise==='string'&&Array.isArray(e.sets));
const selected=()=>window.RepTrackSelectedDate?.()||dayKey(new Date());
const history=name=>logs().filter(e=>canon(e.exercise)===canon(name)).sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0));
const previous=(name,date)=>history(name).filter(e=>e.date<date&&e.sets.length).at(-1);
const make=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e};
let active='',viewDate='',signature='',weekSignature='',scheduled=false;
function rebuildOptions(date){
 const suggested=window.RepTrackPlanForDate?.(date)?.ex.map(e=>canon(e[0]))||[];
 const names=[...new Set([...suggested,...(catalog?.all(logs())||[]).map(x=>x.name)])].filter(Boolean);
 const picker=$('inlineExercise');picker.replaceChildren();
 for(const name of names.sort((a,b)=>a.localeCompare(b))){const o=make('option','',name);o.value=name;picker.append(o)}
 active=names.includes(active)?active:(suggested.includes('Back Squat')?'Back Squat':suggested[0]||names[0]||'');
 picker.value=active;
}
function rowsFor(date,name){
 const today=history(name).filter(e=>e.date===date),all=today.flatMap(e=>e.sets.map((set,index)=>({id:e.id,index,set})));
 const target=window.RepTrackDailySquatTarget?.(date);
 if(name==='Back Squat'&&target){
  const warmups=window.RepTrackPersonalPlan.warmups;
  const specs=[
   ['warmup-1','WU 1',warmups?.[0]?.weight??45,warmups?.[0]?.reps??4,true],
   ['warmup-2','WU 2',warmups?.[1]?.weight??135,warmups?.[1]?.reps??8,true],
   ['working-1','WORK 1',target.weight,target.reps,false],
   ['working-2','WORK 2',target.weight,target.reps,false]
  ];
  const used=new Set();
  return specs.map(([slot,label,weight,reps,warmup])=>{
   const existing=all.find(x=>!used.has(x)&&x.set.checklistSlot===slot)||all.find(x=>!used.has(x)&&!x.set.checklistSlot&&!!x.set.warmup===warmup);
   if(existing)used.add(existing);
   return{slot,label,weight,reps,warmup,existing};
  });
 }
 const last=previous(name,date)?.sets.filter(x=>!x.warmup).at(-1);
 const planned=window.RepTrackPlanForDate?.(date)?.ex.find(e=>canon(e[0])===name);
 const count=Math.min(12,Math.max(3,parseInt(planned?.[1],10)||0,all.length+1));
 return Array.from({length:count},(_,i)=>({slot:'',label:pad(i+1),weight:planned?.[2]||last?.weight||'',reps:last?.reps||Number(String(planned?.[1]||'').match(/[×x]\s*(\d+)/)?.[1])||8,warmup:false,existing:all[i]}));
}
function drawSets(){
 const date=selected();
 if(viewDate!==date){viewDate=date;active='';rebuildOptions(date)}
 else if(!$('inlineExercise').options.length)rebuildOptions(date);
 if(!active)return;
 const specs=rowsFor(date,active),prior=previous(active,date);
 const stamp=JSON.stringify([date,active,specs.map(x=>[x.existing?.id,x.existing?.index,x.existing?.set?.weight,x.existing?.set?.reps]),prior?.date]);
 if(stamp===signature)return;signature=stamp;
 const previousSets=history(active).filter(e=>e.date<date).flatMap(e=>e.sets).filter(s=>!s.warmup);
 const best=previousSets.sort((a,b)=>Number(b.weight)-Number(a.weight)||Number(b.reps)-Number(a.reps))[0];
 const fragment=document.createDocumentFragment();
 for(const [i,spec] of specs.entries()){
  const actual=spec.existing,row=make('div','inline-set-row'+(actual?' completed':''));
  row.dataset.slot=spec.slot;row.dataset.entryId=actual?.id||'';row.dataset.setIndex=actual?.index??'';row.dataset.warmup=String(spec.warmup);
  row.append(make('span','inline-set-number',spec.label),make('span','inline-set-target',spec.weight!==''?spec.weight+' × '+spec.reps:'—'),make('span','inline-set-best',best?best.weight+' × '+best.reps:'—'));
  const weightWrap=make('div','inline-input-cell'),weight=make('input','inline-weight');weight.type='number';weight.inputMode='decimal';weight.min='0';weight.step='0.5';weight.value=actual?.set?.weight??spec.weight;weight.setAttribute('aria-label','Set '+(i+1)+' weight');
  const steps=make('div','inline-steppers');
  for(const n of [2.5,5]){const b=make('button','', '+'+n);b.type='button';b.dataset.step=n;b.dataset.field='weight';steps.append(b)}
  weightWrap.append(weight,steps);
  const repWrap=make('div','inline-input-cell'),reps=make('input','inline-reps');reps.type='number';reps.inputMode='numeric';reps.min='1';reps.step='1';reps.value=actual?.set?.reps??spec.reps;reps.setAttribute('aria-label','Set '+(i+1)+' reps');
  const inc=make('button','inline-rep-step','+1');inc.type='button';inc.dataset.step='1';inc.dataset.field='reps';repWrap.append(reps,inc);
  const save=make('button','inline-save-set'+(actual?' is-saved':''),'✓');save.type='button';save.dataset.save='1';save.setAttribute('aria-label',(actual?'Update':'Save')+' set '+(i+1));
  row.append(weightWrap,repWrap,save);fragment.append(row);
 }
 $('inlineSetRows').replaceChildren(fragment);
 $('inlineAddSet').classList.toggle('hidden',active==='Back Squat'&&!!window.RepTrackDailySquatTarget?.(date));
}
function drawWeek(){
 const date=dayDate(selected()),monday=new Date(date);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return d});
 const stamps=days.map(dayKey),last=stamps.join('|')+':'+selected()+':'+logs().length;
 if(last===weekSignature)return;weekSignature=last;
 const strip=$('weekStrip');strip.replaceChildren();
 for(const date of days){
  const stamp=dayKey(date),recorded=logs().some(e=>e.date===stamp&&e.sets.length)||!!window.RepTrackInlineWhoop?.(stamp)?.length;
  const btn=make('button','week-day'+(stamp===selected()?' is-current':''));btn.type='button';btn.dataset.date=stamp;
  btn.append(make('span','',date.toLocaleDateString(undefined,{weekday:'short'})),make('strong','',String(date.getDate())),make('small','',recorded?'✓':'○'));strip.append(btn);
 }
}
function drawSummary(){
 const date=selected(),strength=window.RepTrackInlineHistory?.(date)||[],whoop=window.RepTrackInlineWhoop?.(date)||[],saved=window.RepTrackInlineCompleted?.(date)||[],host=$('unifiedSessionSummary');
 host.replaceChildren();if(!strength.length&&!whoop.length&&!saved.length)return;
 const sets=strength.reduce((n,e)=>n+e.sets.length,0),volume=strength.reduce((n,e)=>n+e.sets.reduce((v,x)=>v+Number(x.weight)*Number(x.reps),0),0);
 const card=make('div','unified-card');card.append(make('h3','','Session summary'));
 const metrics=make('div','unified-metrics');
 for(const [name,value] of [['SETS',sets],['VOLUME',Math.round(volume).toLocaleString()+' lb·reps'],['WHOOP',whoop.length]]){
  const box=make('div','');box.append(make('small','',name),make('strong','',String(value)));metrics.append(box);
 }
 card.append(metrics);
 for(const activity of whoop){
  const mins=(Date.parse(activity.end)-Date.parse(activity.start))/60000,info=[];
  if(Number.isFinite(mins)&&mins>=0)info.push(Math.round(mins)+' min');
  if(activity.score?.strain!=null)info.push('Strain '+Number(activity.score.strain).toFixed(1));
  if(activity.score?.average_heart_rate!=null)info.push(Math.round(activity.score.average_heart_rate)+' bpm');
  card.append(make('p','unified-whoop',String(activity.sport_name||'Workout').replace(/_/g,' ')+' · '+info.join(' · ')));
 }
 if(saved.length)card.append(make('p','unified-whoop',saved.map(s=>s.title).join(' · ')));
 if(strength.length)card.append(make('p','unified-whoop',strength.map(x=>x.exercise+' ('+x.sets.length+')').join(' · ')));
 host.append(card);
}
function refresh(){
 if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;drawSets();drawWeek();drawSummary();drawReadiness()});
}
window.RepTrackInlineRefresh=refresh;
$('inlineExercise').addEventListener('change',e=>{active=e.target.value;signature='';drawSets()});
$('inlineNewExercise').addEventListener('change',e=>{
 const name=canon(e.target.value);if(!name)return;
 active=name;signature='';
 if(![...$('inlineExercise').options].some(o=>o.value===name)){const option=make('option','',name);option.value=name;$('inlineExercise').append(option)}
 $('inlineExercise').value=name;e.target.value='';drawSets();
});
$('inlineLoadLast').addEventListener('click',()=>{
 const prior=previous(active,selected());
 if(!prior){$('inlineLogStatus').textContent='No earlier logged session';return}
 const last=prior.sets.filter(x=>!x.warmup),rows=[...$('inlineSetRows').children].filter(x=>!x.dataset.entryId&&x.dataset.warmup!=='true');
 rows.forEach((row,i)=>{const set=last[i]||last.at(-1);if(set){row.querySelector('.inline-weight').value=set.weight;row.querySelector('.inline-reps').value=set.reps}});
 $('inlineLogStatus').textContent='Last session loaded';
});
$('inlineAddSet').addEventListener('click',()=>{
 const last=$('inlineSetRows').lastElementChild;if(!last)return;
 const row=last.cloneNode(true);row.dataset.slot='';row.dataset.entryId='';row.dataset.setIndex='';row.classList.remove('completed');
 row.querySelector('.inline-set-number').textContent=pad($('inlineSetRows').children.length+1);row.querySelector('.inline-save-set').classList.remove('is-saved');$('inlineSetRows').append(row);
});
$('inlineSetRows').addEventListener('click',e=>{
 const row=e.target.closest('.inline-set-row');if(!row)return;
 const step=e.target.closest('[data-step]');
 if(step){const input=row.querySelector(step.dataset.field==='weight'?'.inline-weight':'.inline-reps');input.value=String(Math.max(0,Number(input.value||0)+Number(step.dataset.step)));return}
 if(!e.target.closest('[data-save]'))return;
 const w=row.querySelector('.inline-weight'),r=row.querySelector('.inline-reps');
 if(!w.value.trim()||!r.value.trim()){(w.value.trim()?r:w).focus();return}
 const response=window.RepTrackInlineSaveSet?.({date:selected(),exercise:active,weight:Number(w.value),reps:Number(r.value),warmup:row.dataset.warmup==='true',checklistSlot:row.dataset.slot||null,entryId:row.dataset.entryId||null,setIndex:row.dataset.setIndex===''?null:Number(row.dataset.setIndex)});
 if(!response?.ok){$('inlineLogStatus').textContent=response?.error||'Unable to save set';return}
 row.dataset.entryId=response.id;row.dataset.setIndex=response.index;row.classList.add('completed');row.querySelector('.inline-save-set').classList.add('is-saved');
 window.RepTrackInlineStartRest?.();$('inlineLogStatus').textContent='Set saved · rest started';
});
$('weekStrip').addEventListener('click',e=>{const btn=e.target.closest('button[data-date]');if(btn)window.RepTrackOpenCalendarDay?.(btn.dataset.date)});
let touchStart=null;
$('weekStrip').addEventListener('touchstart',e=>touchStart=e.changedTouches[0]?.clientX??null,{passive:true});
$('weekStrip').addEventListener('touchend',e=>{
 if(touchStart===null)return;
 const change=(e.changedTouches[0]?.clientX??touchStart)-touchStart;touchStart=null;if(Math.abs(change)<50)return;
 const d=dayDate(selected());d.setDate(d.getDate()+(change<0?7:-7));window.RepTrackOpenCalendarDay?.(dayKey(d));
},{passive:true});
const readinessKey='reptrack-manual-readiness-v1';
function drawReadiness(){
 const connected=window.RepTrackWHOOPStatus?.connected===true;
 document.querySelectorAll('[data-readiness-card]').forEach(e=>e.classList.toggle('manual-ready',!connected));
 if(connected)return;
 const day=read(readinessKey,{})[selected()];
 $('recoveryMetric').textContent=day?(10-day.soreness)+' / 10':'Check in';
 $('sleepMetric').textContent=day?day.sleep+'%':'Log sleep';
 $('strainMetric').textContent=day?day.energy+' / 10':'Log energy';
 $('recoveryCaption').textContent=day?'MANUAL CHECK-IN':'TAP TO LOG';
 $('guidanceText').textContent=!day?'Tap a readiness card to check in.':day.soreness>=7||day.energy<=3?'Prioritize recovery today.':day.soreness>=4?'Consider a lighter technique session.':'Use your planned workout if movement feels normal.';
}
document.querySelectorAll('[data-readiness-card]').forEach(card=>{
 const open=()=>{if(window.RepTrackWHOOPStatus?.connected)return;
  const day=read(readinessKey,{})[selected()];if(day){$('manualSleep').value=day.sleep;$('manualSoreness').value=day.soreness;$('manualEnergy').value=day.energy}
  $('readinessDialog').showModal();
 };
 card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
});
$('readinessForm').addEventListener('submit',e=>{
 if(e.submitter?.value!=='save')return;
 const sleep=Number($('manualSleep').value),soreness=Number($('manualSoreness').value),energy=Number($('manualEnergy').value);
 if(![sleep,soreness,energy].every(Number.isFinite)||sleep<0||sleep>100||soreness<0||soreness>10||energy<0||energy>10){e.preventDefault();return}
 try{localStorage.setItem(readinessKey,JSON.stringify({...read(readinessKey,{}),[selected()]:{sleep,soreness,energy,savedAt:new Date().toISOString()}}))}catch{e.preventDefault();alert('Unable to save check-in');return}
 requestAnimationFrame(drawReadiness);
});
window.addEventListener('reptrack-whoop-updated',()=>requestAnimationFrame(drawReadiness));
$('configureSquatBlock').addEventListener('click',()=>{
 $('configureSquatMax').value=window.RepTrackPersonalPlan.max;
 $('configureSquatStart').value=window.RepTrackPersonalPlan.start;
 $('configureSquatDialog').showModal();
});
$('configureSquatForm').addEventListener('submit',e=>{
 if(e.submitter?.value!=='save')return;
 const max=Number($('configureSquatMax').value),start=$('configureSquatStart').value;
 if(max<45||max>1000||!Number.isFinite(max)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||dayKey(dayDate(start))!==start){e.preventDefault();return}
 try{localStorage.setItem('reptrack-squat-block-config-v1',JSON.stringify({max,start}))}catch{e.preventDefault();alert('Unable to save block settings');return}
 location.reload();
});
function init(){
 const calendar=$('trainingCalendar'),inspector=$('selectedDay'),page=document.querySelector('[data-page="calendar"]');
 if(calendar&&inspector&&page){const layout=make('div','calendar-command-layout');calendar.before(layout);layout.append(calendar,inspector);inspector.querySelector('.section')?.classList.add('active-inspector')}
 rebuildOptions(selected());viewDate=selected();drawSets();drawWeek();drawSummary();drawReadiness();
}
init();
})();