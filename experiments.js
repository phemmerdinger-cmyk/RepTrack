(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='reptrack-experiments-v1';
const initial=[70,50,45,75,40,60,50]; // Sunday to Saturday
const dayOrder=[1,2,3,4,5,6,0],names=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const read=()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||'null');return p&&typeof p==='object'?p:null}catch{return null}};
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const round5=n=>Math.max(5,Math.round(n/5)*5);
const el=(tag,cls,text)=>{const v=document.createElement(tag);if(cls)v.className=cls;if(text!==undefined)v.textContent=text;return v};
const percentageFor=(data,dow)=>Number(data?.percentages?.[dow])||initial[dow];
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
  const date=new Date(2026,10,9+index),stamp=iso(date);
  const prescription=window.RepTrackDailySquatTarget?.(stamp);
  if(!prescription)continue;
  const line=el('button','experiment-month-row'),dateEl=el('span','',date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));
  line.type='button';line.setAttribute('aria-label','Open '+stamp+' daily Back Squat plan');
  const target=el('strong','',prescription.weight+' LB × '+prescription.reps+' · 2 SETS');
  const flag=el('small','',prescription.reported?'REPORTED':'TARGET');
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
 $('experimentState').textContent=active?'ACTIVE':exp?.start?'STOPPED':'NOT STARTED';
 $('experimentState').classList.toggle('active',active);
 $('experimentApply').textContent=active?'UPDATE MY EXPERIMENT':'ADD TO MY CALENDAR';
 $('experimentStop').classList.toggle('hidden',!active);
 if(exp){
  $('experimentDescription').value=exp.description||'I am squatting every day for the next month.';
  $('experimentMax').value=Number(exp.max)||325;
 }
 renderPreview();
 renderMonthPlan();
 if(active){
  const end=new Date(exp.start+'T12:00:00');end.setDate(end.getDate()+29);
  $('experimentMessage').textContent='Your Nov 9–Dec 8 two-set squat schedule is already visible on every calendar day. This card can still hold your experiment notes. The fixed 30-day targets below take priority over older weekday percentages.';
 }else if(exp?.start){
  $('experimentMessage').textContent='The 30-day Nov 9–Dec 8 squat block is still scheduled. This older optional experiment switch does not remove the new daily targets.';
 }else{
  $('experimentMessage').textContent='Your Nov 9–Dec 8 daily squat schedule is already added to the calendar. The button above saves your optional experiment description and percentages for future training.';
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
window.addEventListener('storage',e=>{if(e.key===KEY)render()});
render();
})();