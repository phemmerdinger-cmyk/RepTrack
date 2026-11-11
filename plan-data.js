/* Personal program defaults. Loaded only when no plan data is already saved. */
(()=>{'use strict';
const KEY='reptrack-personal-plan-v1';
const initial={version:1,start:'2026-11-09',max:325,duration:30,warmups:[{weight:45,reps:4},{weight:135,reps:8}],baseline:{date:'2026-11-09',weight:265,reps:6,sets:2},weeklyPercentages:[70,50,45,75,40,60,50],squatMonth:[
 {week:1,wednesday:'2026-11-11',sunday:'2026-11-15',heavy:185,volume:225,heel:185,light:true},
 {week:2,wednesday:'2026-11-18',sunday:'2026-11-22',heavy:250,volume:230,heel:205},
 {week:3,wednesday:'2026-11-25',sunday:'2026-11-29',heavy:255,volume:235,heel:210},
 {week:4,wednesday:'2026-12-02',sunday:'2026-12-06',heavy:260,volume:240,heel:215}
],dailySquats:[
 [265,6],[165,15],[135,10],[185,8],[155,12],[115,12],[205,8],
 [245,6],[170,12],[140,10],[190,8],[160,12],[120,12],[210,8],
 [250,6],[175,12],[145,10],[195,8],[165,12],[125,12],[215,8],
 [255,6],[180,12],[150,10],[200,8],[170,12],[130,12],[220,8],
 [260,6],[185,12]
]};
let saved;
try{const raw=localStorage.getItem(KEY);if(raw===null){localStorage.setItem(KEY,JSON.stringify(initial));saved=initial}else saved=JSON.parse(raw)}catch{saved=null}
const good=saved&&typeof saved==='object'&&Array.isArray(saved.dailySquats)&&saved.dailySquats.length===30&&Array.isArray(saved.squatMonth);
window.RepTrackPersonalPlan=good?saved:initial;
window.RepTrackPersonalPlanKey=KEY;
})();
