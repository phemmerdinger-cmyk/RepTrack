(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='reptrack-experiments-v1';
const initial=window.RepTrackPersonalPlan?.weeklyPercentages||[70,50,45,75,40,60,50]; // Sunday to Saturday
const dayOrder=[1,2,3,4,5,6,0],names=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const read=()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||'null');return p&&typeof p==='object'?p:null}catch{return null}};
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const round5=n=>Math.max(5,Math.round(n/5)*5);
const el=(tag,cls,text)=>{const v=document.createElement(tag);if(cls)v.className=cls;if(text!==undefined)v.textContent=text;return v};
const percentageFor=(data,dow)=>Number(data?.percentages?.[dow])||initial[dow];
const band=p=>p>=75?'heavy':p>=55?'moderate':p>=40?'light':'recovery';
const bandName=p=>({heavy:'Heavy',moderate:'Moderate',light:'Light',recovery:'Recovery'})[band(p)];
function renderPreview(){
 const exp=read(),oneRM=Number($('experimentMax').value)||325;
 const dates=document.getElementById('experimentDaysPreview');dates.replaceChildren();
 const source=exp?.start?new Date(exp.start+'T12:00:00'):new Date();
 const reference=new Date(source.getFullYear(),source.getMonth(),source.getDate());
 dayOrder.forEach(dow=>{
  const item=el('label','experiment-percent-day'),label=el('span','',names[dow]),percent=el('input');
  percent.type='number';percent.inputMode='numeric';percent.min=20;percent.max=95;percent.step=5;percent.value=percentageFor(exp,dow);
  percent.dataset.weekday=String(dow);percent.setAttribute('aria-label',names[dow]+' squat intensity as percent of estimated one rep max');
  const weight=el('strong','',round5(oneRM*Number(percent.value)/100)+' LB'),pct=el('small','','% 1RM');
  percent.addEventListener('input',()=>{
   const v=Number(percent.value);weight.textContent=Number.isFinite(v)&&v>=20&&v<=95?round5(oneRM*v/100)+' LB':'— LB';
  });
  item.append(label,percent,pct,weight);dates.append(item);
 });
}
function renderMonthPlan(){
 const grid=$('experimentMonthRows');if(!grid)return;
 grid.replaceChildren();
 for(let index=0;index<30;index++){
  const start=new Date((window.RepTrackPersonalPlan?.start||'2026-11-09')+'T12:00:00');start.setDate(start.getDate()+index);
  const date=start,stamp=iso(date);
  const prescription=window.RepTrackDailySquatTarget?.(stamp);
  if(!prescription)continue;
  const line=el('button','experiment-month-row intensity-'+band(prescription.percentage)),dateEl=el('span','',date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));
  line.type='button';line.setAttribute('aria-label','Open '+stamp+' daily Back Squat plan');
  const target=el('strong','',prescription.weight+' LB × '+prescription.reps+' · 2 SETS');
  const current=window.RepTrackSquatStatus?.(stamp)||'Planned';
  const flag=el('small','',bandName(prescription.percentage)+' · '+prescription.percentage+'% · '+current);
  line.append(dateEl,target,flag);
  line.addEventListener('click',()=>{
   document.querySelector('[data-view="calendar"]')?.click();
   window.RepTrackOpenCalendarDay?.(stamp);
  });
  grid.append(line);
 }
}

function render(){
 const exp=read(),active=!!exp?.active;
 const start=new Date((window.RepTrackPersonalPlan?.start||'2026-11-09')+'T12:00:00');
 const today=new Date();const day=Math.floor((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000)+1;
 const logged=Array.from({length:30},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return window.RepTrackSquatStatus?.(iso(d))==='Completed'}).filter(Boolean).length;
 const planState=day<1?'PLANNED':logged===30?'COMPLETED':day<=30?'ACTIVE':'IN PROGRESS';
 $('experimentState').textContent=planState+(day>=1?' · DAY '+Math.min(day,30)+' / 30':'');
 $('experimentState').classList.toggle('active',day>=1&&day<=30);
 $('experimentApply').textContent=active?'UPDATE EXPERIMENT NOTES':'SAVE EXPERIMENT NOTES';
 $('experimentStop').classList.toggle('hidden',!active);
 if(exp){
  $('experimentDescription').value=exp.description||'I am squatting every day for the next month.';
  $('experimentMax').value=Number(exp.max)||325;
 }
 renderPreview();
 renderMonthPlan();
 if(active){
  const end=new Date(exp.start+'T12:00:00');end.setDate(end.getDate()+29);
  $('experimentMessage').textContent='The 30-day squat rotation is already planned. Heavy, moderate, light, and recovery targets alternate by design. Only saved Back Squat sets complete a day.';
 }else if(exp?.start){
  $('experimentMessage').textContent='Your saved squat rotation stays intact. Planned loads do not count as completed workouts.';
 }else{
  $('experimentMessage').textContent='Your 30-day targets are already in the calendar. Save optional notes here, or tap a date to see its two working sets.';
 }
}
function notify(){window.dispatchEvent(new Event('reptrack-experiments-changed'));window.dispatchEvent(new Event('reptrack-workouts-changed'))}
function apply(){
 const description=$('experimentDescription').value.trim();
 if(!description){$('experimentMessage').textContent='Describe what you want to do first.';return}
 if(!/\bsquat(?:ting|s)?\b/i.test(description)){ $('experimentMessage').textContent='This first experiment supports a daily squat challenge. Include “squat” in your description.';return }
 const max=Number($('experimentMax').value);
 if(!Number.isFinite(max)||max<45||max>1000){$('experimentMessage').textContent='Enter an estimated squat max between 45 and 1,000 lb.';return}
 const percentages=[...initial],inputs=$('experimentDaysPreview').querySelectorAll('input[data-weekday]');
 for(const input of inputs){const pct=Number(input.value);if(!Number.isFinite(pct)||pct<20||pct>95){$('experimentMessage').textContent='Every day needs a percentage between 20% and 95%.';input.focus();return}percentages[Number(input.dataset.weekday)]=pct}
 const previous=read(),start=previous?.active&&previous.start?previous.start:iso(new Date());
 const data={version:1,type:'squat-every-day',description:description.slice(0,600),start,duration:30,max,percentages,active:true};
 try{localStorage.setItem(KEY,JSON.stringify(data))}catch{$('experimentMessage').textContent='Could not save the experiment to this device.';return}
 notify();render();
 document.querySelector('[data-view="calendar"]')?.click();
 const calendar=document.getElementById('monthGrid');
 calendar?.scrollIntoView({behavior:'smooth',block:'start'});
}
function stop(){
 const exp=read();if(!exp?.active)return;
 if(!confirm('Stop adding squat sets to upcoming workouts? Previously logged squats will not be deleted.'))return;
 try{localStorage.setItem(KEY,JSON.stringify({...exp,active:false}))}catch{alert('Unable to save this change.');return}
 notify();render();
}
$('experimentApply').addEventListener('click',apply);
$('experimentStop').addEventListener('click',stop);
$('experimentMax').addEventListener('input',()=>{document.querySelectorAll('.experiment-percent-day').forEach(label=>{const input=label.querySelector('input');const val=Number(input.value),max=Number($('experimentMax').value);label.querySelector('strong').textContent=val>=20&&max>=45?round5(val*max/100)+' LB':'— LB'})});
document.querySelectorAll('[data-view="experiments"]').forEach(b=>b.addEventListener('click',render));
window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='reptrack-workouts-v1')render()});
window.addEventListener('reptrack-workouts-changed',render);
render();
})();