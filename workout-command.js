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
let active='',viewDate='',signature='',weekSignature='',scheduled=false,rowContext='';
const DRAFT_KEY='reptrack-entry-drafts-v1';
let drafts={};try{const v=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))drafts=v}catch{}
const draftKey=()=>selected()+'|'+active;
const draftRows=()=>Array.isArray(drafts[draftKey()])?drafts[draftKey()]:[];
function persistDrafts(){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(drafts))}catch{}}
function rememberRow(row){
 const index=[...$('inlineSetRows').children].indexOf(row);if(index<0)return;
 const rows=draftRows().slice();rows[index]={weight:row.querySelector('.inline-weight').value,reps:row.querySelector('.inline-reps').value};drafts[draftKey()]=rows;persistDrafts();
 row.dataset.dirty='true';row.classList.remove('completed');const button=row.querySelector('[data-save]');button.textContent=row.dataset.entryId?'Save changes':'Save set';button.classList.remove('is-saved');
}
function clearDraft(row){const rows=draftRows().slice(),index=[...$('inlineSetRows').children].indexOf(row);rows[index]=null;while(rows.length&&!rows.at(-1))rows.pop();drafts[draftKey()]=rows;persistDrafts();row.dataset.dirty='false'}

function rebuildOptions(date){
 const suggested=window.RepTrackPlanForDate?.(date)?.ex.map(e=>canon(e[0]))||[];
 const names=[...new Set([...suggested,...(catalog?.all(logs())||[]).map(x=>x.name)])].filter(Boolean);
 const picker=$('inlineExercise');picker.replaceChildren();
 for(const [label,items] of [['Planned for this workout',suggested],['Other exercises',names.filter(name=>!suggested.includes(name)).sort((a,b)=>a.localeCompare(b))]]){const group=make('optgroup');group.label=label;for(const name of [...new Set(items)]){const option=make('option','',name);option.value=name;group.append(option)}if(group.children.length)picker.append(group)}
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
 const count=Math.max(1,parseInt(planned?.[1],10)||3,all.length,draftRows().length);
 return Array.from({length:count},(_,i)=>({slot:'',label:pad(i+1),weight:planned?.[2]!==undefined&&planned[2]!==''?planned[2]:(last?.weight??''),reps:last?.reps||Number(String(planned?.[1]||'').match(/[×x]\s*(\d+)/)?.[1])||8,warmup:false,existing:all[i]}));
}
function drawSets(){
 const date=selected();
 if(viewDate!==date){viewDate=date;active='';rebuildOptions(date)}
 else if(!$('inlineExercise').options.length)rebuildOptions(date);
 if(!active)return;
 const specs=rowsFor(date,active),prior=previous(active,date);
 $('inlineActiveExercise').textContent=active;
 const context=date+'|'+active;
 if(rowContext!==context){$('inlineSetRows').replaceChildren();rowContext=context}
 const stamp=JSON.stringify([date,active,specs.map(x=>[x.existing?.id,x.existing?.index,x.existing?.set?.weight,x.existing?.set?.reps]),prior?.date]);
 if(stamp===signature)return;signature=stamp;
 const previousSets=history(active).filter(e=>e.date<date).flatMap(e=>e.sets).filter(s=>!s.warmup);
 const best=previousSets.sort((a,b)=>Number(b.weight)-Number(a.weight)||Number(b.reps)-Number(a.reps))[0];
 const host=$('inlineSetRows');
 for(const [i,spec] of specs.entries()){
  const actual=spec.existing,existing=host.children[i];
  if(existing){
   existing.dataset.entryId=actual?.id||'';existing.dataset.setIndex=actual?.index??'';
   if(existing.dataset.dirty!=='true'){
    existing.querySelector('.inline-weight').value=actual?.set?.weight??spec.weight;
    existing.querySelector('.inline-reps').value=actual?.set?.reps??spec.reps;
    existing.classList.toggle('completed',!!actual);
    const button=existing.querySelector('[data-save]');button.textContent=actual?'Saved ✓':'Save set';button.classList.toggle('is-saved',!!actual);
   }
   continue;
  }
  const draft=draftRows()[i],row=make('div','inline-set-row'+(actual&&!draft?' completed':''));
  row.dataset.dirty=draft?'true':'false';
  row.dataset.slot=spec.slot;row.dataset.entryId=actual?.id||'';row.dataset.setIndex=actual?.index??'';row.dataset.warmup=String(spec.warmup);
  row.append(make('span','inline-set-number',spec.label),make('span','inline-set-target',spec.weight!==''?spec.weight+' × '+spec.reps:'—'),make('span','inline-set-best',best?best.weight+' × '+best.reps:'—'));
  const weightWrap=make('div','inline-input-cell'),weight=make('input','inline-weight');weight.type='number';weight.inputMode='decimal';weight.min='0';weight.step='0.5';weight.value=draft?.weight??actual?.set?.weight??spec.weight;weight.setAttribute('aria-label','Set '+(i+1)+' weight');
  const steps=make('div','inline-steppers');
  for(const n of [2.5,5]){const b=make('button','', '+'+n);b.type='button';b.dataset.step=n;b.dataset.field='weight';steps.append(b)}
  weightWrap.append(weight,steps);
  const repWrap=make('div','inline-input-cell'),reps=make('input','inline-reps');reps.type='number';reps.inputMode='numeric';reps.min='1';reps.step='1';reps.value=draft?.reps??actual?.set?.reps??spec.reps;reps.setAttribute('aria-label','Set '+(i+1)+' reps');
  const inc=make('button','inline-rep-step','+1');inc.type='button';inc.dataset.step='1';inc.dataset.field='reps';repWrap.append(reps,inc);
  const save=make('button','inline-save-set'+(actual&&!draft?' is-saved':''),actual?(draft?'Save changes':'Saved ✓'):'Save set');save.type='button';save.dataset.save='1';save.setAttribute('aria-label',(actual?'Update':'Save')+' set '+(i+1));
  row.append(weightWrap,repWrap,save);host.append(row);
 }

 $('inlineAddSet').classList.toggle('hidden',active==='Back Squat'&&!!window.RepTrackDailySquatTarget?.(date));
}
let outlookSignature='',prescriptionSignature='';
const squatSummary=date=>{
 const target=window.RepTrackDailySquatTarget?.(date);
 if(!target)return 'No daily squat target on this date';
 const intensity=target.percentage>=75?'Heavy':target.percentage>=55?'Moderate':target.percentage>=40?'Light':'Recovery';
 return 'Daily squat: '+target.sets+' × '+target.reps+' at '+target.weight+' lb · '+intensity;
};
function drawOutlook(){
 const today=new Date(),tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
 const days=[today,tomorrow].map((date,i)=>({date:dayKey(date),label:i?'Tomorrow':'Today',plan:window.RepTrackPlanForDate?.(dayKey(date))}));
 const sig=JSON.stringify(days.map(x=>[x.date,x.plan,squatSummary(x.date)]));if(sig===outlookSignature)return;outlookSignature=sig;
 const host=$('trainingOutlook');host.replaceChildren();
 for(const day of days){
  const card=make('article','outlook-card'),heading=make('h2','',day.label+' · '+dayDate(day.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));
  const name=make('strong','outlook-workout',day.plan?.title||'No workout planned');
  const muscles=day.plan?.ex.filter(([name])=>!/^Back Squat$/i.test(name)).map(([name])=>name).join(' · ');
  const squat=make('p','outlook-squat',squatSummary(day.date));
  const button=make('button','smallbtn',day.label==='Today'?'Open today’s workout':'Preview tomorrow');button.type='button';button.addEventListener('click',()=>{window.RepTrackOpenCalendarDay?.(day.date);requestAnimationFrame(()=>{$('selectedDay').scrollIntoView({block:'start',behavior:'instant'});$('dayWorkout').tabIndex=-1;$('dayWorkout').focus({preventScroll:true})})});
  card.append(heading,name,make('p','outlook-focus',day.plan?.focus.split(' · Squat')[0]||'Your planned training'),make('p','outlook-exercises',muscles||'Rest and recovery'),squat,button);host.append(card);
 }
 const note=make('p','outlook-reason','The default rotation puts Push on Sunday and Legs on Monday with the heavier squat. The daily squat check-in is separate from your regular workout.');host.append(note);
}
function drawPrescription(){
 const date=selected(),plan=window.RepTrackPlanForDate?.(date);if(!plan)return;
 const sig=JSON.stringify([date,plan]);if(sig===prescriptionSignature)return;prescriptionSignature=sig;
 const host=$('workoutPrescription');host.replaceChildren();
 host.append(make('h3','','What to train: '+plan.title),make('p','prescription-squat',squatSummary(date)+' · Warmups: 45 lb × 4, 135 lb × 8'));
 const list=make('ol','prescription-exercises');
 for(const [name,sets,weight] of plan.ex.filter(([name])=>!/^Back Squat$/i.test(name))){
  const row=make('li'),button=make('button','prescription-exercise');button.type='button';
  button.append(make('strong','',name),make('span','',sets+(weight!==undefined&&weight!==''?' · '+weight+' lb':'')));
  button.addEventListener('click',()=>{
   active=canon(name);$('inlineExercise').value=active;signature='';drawSets();
   $('inlineLogger').scrollIntoView({block:'nearest',behavior:'instant'});$('inlineSetRows').querySelector('input')?.focus();
  });row.append(button);list.append(row);
 }
 host.append(make('p','prescription-help','Your regular workout is below. Select an exercise to load its sets into the logger.'),list);
}
function drawWeek(){
 const date=dayDate(selected()),monday=new Date(date);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return d});
 const stamps=days.map(dayKey),last=stamps.join('|')+':'+selected()+':'+logs().length+':'+stamps.map(stamp=>window.RepTrackPlanForDate?.(stamp)?.title).join('|');
 if(last===weekSignature)return;weekSignature=last;
 const strip=$('weekStrip');strip.replaceChildren();
 for(const date of days){
  const stamp=dayKey(date),recorded=logs().some(e=>e.date===stamp&&e.sets.length)||!!window.RepTrackInlineWhoop?.(stamp)?.length;
  const btn=make('button','week-day'+(stamp===selected()?' is-current':''));btn.type='button';btn.dataset.date=stamp;
  const title=window.RepTrackPlanForDate?.(stamp)?.title||'Rest';
  btn.setAttribute('aria-label',date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})+' · '+title+(recorded?' · Logged sets':''));
  btn.append(make('span','',date.toLocaleDateString(undefined,{weekday:'short'})),make('strong','',String(date.getDate())),make('small','week-workout-name',title),make('span','week-log-state',recorded?'✓':'○'));strip.append(btn);
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
 if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;drawOutlook();drawPrescription();drawSets();drawWeek();drawSummary();drawReadiness()});
}
window.RepTrackInlineRefresh=refresh;
window.addEventListener('reptrack-plan-changed',()=>{prescriptionSignature='';outlookSignature='';weekSignature='';rebuildOptions(selected());signature='';refresh()});
window.addEventListener('focus',refresh);
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
 rows.forEach((row,i)=>{const set=last[i]||last.at(-1);if(set){row.querySelector('.inline-weight').value=set.weight;row.querySelector('.inline-reps').value=set.reps;rememberRow(row)}});
 $('inlineLogStatus').textContent='Last session loaded';
});
$('inlineSetRows').addEventListener('input',event=>{const row=event.target.closest('.inline-set-row');if(row)rememberRow(row)});
$('inlineAddSet').addEventListener('click',()=>{
 const rows=draftRows().slice(),index=$('inlineSetRows').children.length,last=$('inlineSetRows').lastElementChild;
 rows[index]={weight:last?.querySelector('.inline-weight').value||'',reps:last?.querySelector('.inline-reps').value||'8'};drafts[draftKey()]=rows;persistDrafts();signature='';drawSets();
 $('inlineSetRows').lastElementChild?.querySelector('input')?.focus();
});
function validateRow(row){
 const weight=row.querySelector('.inline-weight'),reps=row.querySelector('.inline-reps');
 if(!weight.value.trim()||!Number.isFinite(Number(weight.value))||Number(weight.value)<0||Number(weight.value)>100000){$('inlineLogStatus').textContent='Enter a weight in pounds (0 is allowed for bodyweight).';weight.focus();return false}
 if(!reps.value.trim()||!Number.isInteger(Number(reps.value))||Number(reps.value)<1||Number(reps.value)>1000){$('inlineLogStatus').textContent='Enter the number of reps you completed.';reps.focus();return false}
 return true;
}
function saveRow(row){
 const response=window.RepTrackInlineSaveSet?.({date:selected(),exercise:active,weight:Number(row.querySelector('.inline-weight').value),reps:Number(row.querySelector('.inline-reps').value),warmup:row.dataset.warmup==='true',checklistSlot:row.dataset.slot||null,entryId:row.dataset.entryId||null,setIndex:row.dataset.setIndex===''?null:Number(row.dataset.setIndex)});
 if(!response?.ok){$('inlineLogStatus').textContent=response?.error||'Unable to save set. Your entries are still here.';return false}
 row.dataset.entryId=response.id;row.dataset.setIndex=response.index;clearDraft(row);row.classList.add('completed');
 const button=row.querySelector('[data-save]');button.classList.add('is-saved');button.textContent='Saved ✓';return true;
}
$('inlineSetRows').addEventListener('click',event=>{
 const row=event.target.closest('.inline-set-row');if(!row)return;
 const step=event.target.closest('[data-step]');
 if(step){const input=row.querySelector(step.dataset.field==='weight'?'.inline-weight':'.inline-reps');input.value=String(Math.max(step.dataset.field==='weight'?0:1,Number(input.value||0)+Number(step.dataset.step)));rememberRow(row);return}
 if(!event.target.closest('[data-save]')||!validateRow(row))return;
 if(saveRow(row)){window.RepTrackInlineStartRest?.();$('inlineLogStatus').textContent='Set saved. Keep going or choose the next exercise.'}
});
$('inlineSaveAll').addEventListener('click',()=>{
 const rows=[...$('inlineSetRows').children].filter(row=>row.dataset.dirty==='true'||(!row.dataset.entryId&&row.querySelector('.inline-weight').value.trim()));
 if(!rows.length){$('inlineLogStatus').textContent='Enter a weight and reps in a set, or choose your next exercise.';return}
 if(rows.some(row=>!validateRow(row)))return;
 let saved=0;for(const row of rows){if(!saveRow(row)){$('inlineLogStatus').textContent=saved+' sets saved. The remaining entries are still here; try saving again.';return}saved++}
 window.RepTrackInlineStartRest?.();$('inlineLogStatus').textContent=saved+' set'+(saved===1?'':'s')+' saved for '+active+'.';
});
$('inlineNextExercise').addEventListener('click',()=>{
 const names=window.RepTrackPlanForDate?.(selected())?.ex.map(([name])=>canon(name))||[],next=names[names.indexOf(active)+1];
 if(!next){$('inlineLogStatus').textContent='You reached the last planned exercise. You can choose another exercise above.';return}
 active=next;$('inlineExercise').value=next;signature='';drawSets();$('inlineLogger').scrollIntoView({block:'start',behavior:'instant'});$('inlineActiveExercise').tabIndex=-1;$('inlineActiveExercise').focus({preventScroll:true});
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
 if(calendar&&inspector&&page){if(!calendar.parentElement?.classList.contains('calendar-command-layout')){const layout=make('div','calendar-command-layout');calendar.before(layout);layout.append(calendar,inspector)}inspector.querySelector('.section')?.classList.add('active-inspector')}
 rebuildOptions(selected());viewDate=selected();drawOutlook();drawPrescription();drawSets();drawWeek();drawSummary();drawReadiness();
}
init();
})();