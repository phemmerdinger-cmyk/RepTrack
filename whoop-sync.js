(()=>{'use strict';
const $=id=>document.getElementById(id);
const list=$('whoopWorkoutList'),notice=$('whoopSyncNotice'),count=$('whoopWorkoutCount'),button=$('whoopSyncNow');
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
const dateOf=w=>{
 const t=Date.parse(w.start);if(!Number.isFinite(t))return null;
 const match=/^([+-])(\d{2}):(\d{2})$/.exec(w.timezone_offset||'');
 const offset=match?(match[1]==='-'?-1:1)*(+match[2]*60+(+match[3]))*60000:0;
 return new Date(t+offset).toISOString().slice(0,10);
};
const fmtDate=stamp=>new Date(stamp+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const label=w=>String(w.sport_name||'WHOOP workout').replace(/[_-]/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
const metric=(value,digits=0)=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value).toFixed(digits):'—';
const detail=w=>{
 const score=w.score||{};
 const minutes=Math.max(0,Math.round((Date.parse(w.end)-Date.parse(w.start))/60000))||0;
 return minutes+' min · Strain '+metric(score.strain,1)+' · Avg HR '+metric(score.average_heart_rate)+' bpm · Max HR '+metric(score.max_heart_rate)+' bpm';
};
function render(){
 const data=window.RepTrackWHOOPData,connected=!!data?.connected,access=data?.workoutAccess===true;
 const workouts=connected&&access&&Array.isArray(data.workouts)?data.workouts.filter(x=>x?.id&&dateOf(x)):[];
 list.replaceChildren();
 if(!connected){
  notice.replaceChildren(el('strong','','WHOOP is not connected. '),el('span','','Connect your WHOOP account to automatically show activities.'));
  const link=el('a','whoop-reconnect','CONNECT WHOOP');link.href='/api/whoop/login';notice.append(link);
 }else if(!access){
  notice.replaceChildren(el('strong','','One-time permission update needed. '),el('span','','Your existing connection does not yet allow RepTrack to read workouts.'));
  const link=el('a','whoop-reconnect','RECONNECT WHOOP');link.href='/api/whoop/login';notice.append(link);
 }else{
  const age=Number(window.RepTrackWHOOPLastSync||0),time=age?new Date(age).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'recently';
  notice.textContent='WHOOP connected · Activities checked '+time+' · Automatically updates while RepTrack is open.';
 }
 count.textContent=access?workouts.length+' ACTIVITIES':'SYNC NOT READY';
 if(!connected||!access){
  list.append(el('div','whoop-empty','Connect or reauthorize WHOOP above. No completed workout data will be shown until permission is granted.'));
  return;
 }
 if(!workouts.length){
  list.append(el('div','whoop-empty','No finished WHOOP activities found in the last 45 days. Once WHOOP has processed a workout, it will appear here and in your calendar.'));
  return;
 }
 const sorted=[...workouts].sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
 for(const activity of sorted){
  const stamp=dateOf(activity),card=el('div','whoop-activity-card'),head=el('div','whoop-activity-heading'),body=el('div');
  body.append(el('span','micro',fmtDate(stamp)),el('strong','',label(activity)),el('small','',detail(activity)));
  const view=el('button','smallbtn','VIEW DAY');view.type='button';
  view.addEventListener('click',()=>{
   document.querySelector('[data-view="calendar"]')?.click();
   const stampDate=new Date(stamp+'T12:00:00');
   const today=$('todayButton');today?.click();
   for(let i=0;i<24;i++){
    const currently=$('monthLabel')?.textContent||'',target=stampDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    if(currently===target)break;
    const current=new Date(currently+' 1'),diff=(stampDate.getFullYear()-current.getFullYear())*12+stampDate.getMonth()-current.getMonth();
    if(diff<0)$('prevMonth')?.click();else $('nextMonth')?.click();
   }
   [...document.querySelectorAll('#monthGrid .day')].find(x=>x.dataset.date===stamp)?.click();
  });
  head.append(body,view);card.append(head);list.append(card);
 }
}
button.addEventListener('click',async()=>{
 button.disabled=true;button.textContent='CHECKING…';
 try{
  const response=await fetch('/api/whoop/summary',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('WHOOP unavailable');
  const data=await response.json();window.RepTrackWHOOPData=data;window.RepTrackWHOOPLastSync=Date.now();
  window.dispatchEvent(new Event('reptrack-whoop-updated'));
  render();
  // Refresh calendar from the app's normal periodic WHOOP synchronization.
  window.dispatchEvent(new Event('reptrack-whoop-manual-refresh'));
 }catch{notice.textContent='WHOOP is temporarily unavailable. Your calendar and manual workout history are unaffected.'}
 finally{button.disabled=false;button.textContent='CHECK FOR FINISHED WORKOUTS'}
});
$('startSelectedWorkout')?.addEventListener('click',()=>{document.querySelector('[data-view="workout"]')?.click();render()});
$('drawerStartWorkout')?.addEventListener('click',()=>{
 $('drawerDone')?.click();document.querySelector('[data-view="workout"]')?.click();render();
});
window.addEventListener('reptrack-whoop-updated',render);
document.querySelectorAll('[data-view="workout"]').forEach(el=>el.addEventListener('click',render));
render();
})();