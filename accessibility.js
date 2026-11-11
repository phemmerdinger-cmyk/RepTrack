(()=>{'use strict';
const $=id=>document.getElementById(id);
const shortcuts={
 calendar:[['trainingCalendar','Choose a date'],['selectedDay','Selected workout'],['futureModels','Training guidance'],['recoveryAndTimer','Recovery & rest timer']],
 analytics:[['analyticsAllExercises','Exercise history'],['analyticsWhoopHistory','WHOOP history'],['trainingCharts','Charts']],
 overload:[['squatMonthSection','Squat plan'],['overloadSection','Compare lifts']],
 workout:[['whoopConnection','Connect & refresh'],['whoopRecent','Recent activities']],
 experiments:[['trainingPlanSetup','Plan setup'],['experimentMonthRows','Daily schedule']],
 settings:[['gettingStarted','How to use RepTrack'],['trainingTerms','Training terms'],['dataAndConnection','Backups & account']]
};
const landmarks=[['.analytics-chart-grid','trainingCharts'],['.whoop-sync-actions','whoopConnection'],['.whoop-sync-section','whoopRecent'],['.experiment-card','trainingPlanSetup']];
for(const [selector,id] of landmarks){const node=document.querySelector(selector);if(node)node.id=id}
function refreshShortcuts(){
 const page=document.querySelector('[data-page]:not(.hidden)');if(!page)return;
 const nav=$('pageShortcuts');nav.replaceChildren();
 const label=document.createElement('span');label.textContent='On this page:';nav.append(label);
 for(const [id,text] of shortcuts[page.dataset.page]||[]){
  const target=$(id);if(!target)continue;
  const link=document.createElement('a');link.href='#'+id;link.textContent=text;
  link.addEventListener('click',event=>{event.preventDefault();target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})});nav.append(link);
 }
}
window.addEventListener('reptrack-route-changed',()=>{refreshShortcuts();$('navigationStatus').textContent=document.querySelector('[data-page]:not(.hidden) h1')?.textContent+' page';});
refreshShortcuts();
// A readable agenda is the initial mobile view; the full calendar remains available.
let list=matchMedia('(max-width:700px)').matches;
try{const saved=localStorage.getItem('reptrack-calendar-list-v1');if(saved!==null)list=saved==='true'}catch{}
function applyLayout(){
 $('monthGrid').classList.toggle('calendar-list',list);
 $('trainingCalendar').classList.toggle('calendar-is-list',list);
 $('calendarLayout').setAttribute('aria-pressed',String(list));
 $('calendarLayout').textContent=list?'Month grid':'List view';
 $('calendarLayout').setAttribute('aria-label',list?'Switch to month grid':'Switch to readable date list');
}
$('calendarLayout').addEventListener('click',()=>{list=!list;try{localStorage.setItem('reptrack-calendar-list-v1',String(list))}catch{}applyLayout()});applyLayout();
$('jumpDate').value=window.RepTrackSelectedDate();
$('openChosenDate').addEventListener('click',()=>{const input=$('jumpDate');if(!input.value){input.focus();input.reportValidity();return}window.RepTrackOpenCalendarDay(input.value)});
$('jumpDate').required=true;
// Arrow keys navigate calendar dates without opening the workout panel.
$('monthGrid').addEventListener('keydown',event=>{
 const tile=event.target.closest('.day');if(!tile)return;
 const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
 if(step===undefined)return;event.preventDefault();
 const all=[...$('monthGrid').querySelectorAll('.day')].filter(node=>node.getClientRects().length);
 const index=all.indexOf(tile);all[Math.max(0,Math.min(all.length-1,index+step))]?.focus();
});
// Keep focus and pointer input inside the topmost dialog, including nested logging.
const drawer=$('dayDrawerOverlay'),modal=$('modalOverlay'),app=document.querySelector('.app');
function syncDialogs(){
 const logging=!modal.classList.contains('hidden'),drawing=!drawer.classList.contains('hidden');
 app.inert=logging||drawing;drawer.inert=logging;
 drawer.setAttribute('aria-hidden',String(logging||!drawing));
 modal.setAttribute('aria-hidden',String(!logging));
}
new MutationObserver(syncDialogs).observe(drawer,{attributes:true,attributeFilter:['class']});
new MutationObserver(syncDialogs).observe(modal,{attributes:true,attributeFilter:['class']});syncDialogs();
document.addEventListener('keydown',event=>{
 const active=!modal.classList.contains('hidden')?modal:!drawer.classList.contains('hidden')?drawer:null;
 if(!active||event.key!=='Tab')return;
 const items=[...active.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length&&!node.closest('[inert]'));
 if(!items.length){event.preventDefault();return}
 const first=items[0],last=items.at(-1);
 if(event.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){event.preventDefault();first.focus()}
});
// A text alternative to the charts, using the same locally saved workout records.
const dataDetails=document.createElement('details');dataDetails.className='chart-data section';
dataDetails.innerHTML='<summary>Read workout data as a table</summary><p>All saved sets in this browser, newest first. Chart filters do not change this table.</p><div class="table-scroll" role="region" aria-label="Saved workout sets" tabindex="0"><table><caption>Saved workout sets — weight in pounds</caption><thead><tr><th scope="col">Date</th><th scope="col">Exercise</th><th scope="col">Set type</th><th scope="col">Weight (lb)</th><th scope="col">Reps</th></tr></thead><tbody></tbody></table></div>';
$('trainingCharts').after(dataDetails);
function updateDataTable(){
 const body=dataDetails.querySelector('tbody');body.replaceChildren();let logs=[];
 try{logs=JSON.parse(localStorage.getItem('reptrack-workouts-v1')||'[]')}catch{}
 if(!Array.isArray(logs))logs=[];
 for(const log of logs.filter(x=>x&&typeof x.date==='string'&&Array.isArray(x.sets)).sort((a,b)=>b.date.localeCompare(a.date))){
  for(const set of log.sets){if(!set)continue;const row=document.createElement('tr');
   for(const value of [log.date,log.exercise,set.warmup?'Warmup':'Working',set.weight,set.reps]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}body.append(row);
  }
 }
 if(!body.children.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='No saved sets yet. Log a workout in Calendar to see your data here.';row.append(cell);body.append(row)}
}
dataDetails.addEventListener('toggle',()=>{if(dataDetails.open)updateDataTable()});
window.addEventListener('reptrack-workouts-changed',()=>{if(dataDetails.open)updateDataTable()});
// Convey selected chart and model options beyond color alone.
const groups=document.querySelectorAll('.analytics-toggle,.future-model-switch,.trend-tabs');
function updatePressed(group){group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))))}
for(const group of groups){updatePressed(group);new MutationObserver(()=>updatePressed(group)).observe(group,{subtree:true,attributes:true,attributeFilter:['class']})}
$('whoopStatusClose').addEventListener('click',()=>$('whoopGlobalStatus').focus());
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('whoopStatusDetails').classList.contains('hidden')){$('whoopStatusClose').click()}});
})();
