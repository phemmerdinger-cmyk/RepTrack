/* RepTrack exercise catalog: names and aliases only, no fabricated logs or migrations. */
(()=>{'use strict';
const groups={
  Chest:['Bench Press','Incline Bench Press','Dumbbell Flies','Cable Flies','Low to High Cable Flies','Smith Machine Bench Press','Machine Chest Press'],
  Triceps:['Tricep Pushdown','Tricep Extension','Dip Press','Weighted Dips'],
  Back:['Weighted Pull-Ups','Lat Pulldown','Cable Rows','Lat Pullover','Wide Grip Row','Chest-Supported Dumbbell Row'],
  Biceps:['Incline Curls','Preacher Curls','Hammer Curls','Rope Hammer Curls','Bayesian Curls','Cable Bicep Curls'],
  Shoulders:['Smith Machine Shoulder Press','Dumbbell Shoulder Press','Cable Front Raise','Cable Lateral Raise','Dumbbell Lateral Raises','Rear Delt Flies','Dumbbell Rear Delt Flies'],
  Abs:['Cable Crunches'],
  Legs:['Back Squat','Calf Raise','Hamstring Curls','Hip Abductor','Leg Extensions','Walking Lunges']
};
const records=Object.entries(groups).flatMap(([group,names])=>names.map(name=>({name,group})));
const normalize=v=>String(v||'').trim().toLowerCase().replace(/[‐‑‒–—-]/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const aliases={
 'pull ups':'Weighted Pull-Ups', // Do not conflate unweighted Pull Up with weighted!
};
// Only orthographic aliases that preserve equipment and variation exactly.
delete aliases['pull ups'];
Object.assign(aliases,{
 'weighted pullups':'Weighted Pull-Ups',
 'weighted pull ups':'Weighted Pull-Ups',
 'weighted pull up':'Weighted Pull-Ups',
 'dumbbell fly':'Dumbbell Flies',
 'dumbbell flyes':'Dumbbell Flies',
 'cable fly':'Cable Flies',
 'low to high cable fly':'Low to High Cable Flies',
 'smith machine bench':'Smith Machine Bench Press',
 'chest supported dumbell row':'Chest-Supported Dumbbell Row',
 'chest support dumbell row':'Chest-Supported Dumbbell Row',
 'chest supported dumbbell row':'Chest-Supported Dumbbell Row',
 'dumbbell should press':'Dumbbell Shoulder Press',
 'dumbell shoulder press':'Dumbbell Shoulder Press',
 'dumbbell lateral raise':'Dumbbell Lateral Raises',
 'rear delt fly':'Rear Delt Flies',
 'dumbbell rear delt fly':'Dumbbell Rear Delt Flies',
 'triceps pushdown':'Tricep Pushdown',
 'triceps extension':'Tricep Extension',
 'cable biceps curls':'Cable Bicep Curls',
 'bayesian curl':'Bayesian Curls',
 'rope hammer curl':'Rope Hammer Curls',
 'hammer curl':'Hammer Curls',
 'preacher curl':'Preacher Curls',
 'incline curl':'Incline Curls',
 'cable crunch':'Cable Crunches',
 'leg extension':'Leg Extensions',
 'walking lunge':'Walking Lunges',
 'hamstring curl':'Hamstring Curls',
 'hip abductor machine':'Hip Abductor'
});
const canonicalMap=new Map(records.map(item=>[normalize(item.name),item.name]));
for(const [alias,name] of Object.entries(aliases))if(canonicalMap.has(normalize(name)))canonicalMap.set(normalize(alias),name);
const canonical=name=>canonicalMap.get(normalize(name))||String(name||'').trim();
const groupFor=name=>{const key=canonical(name),item=records.find(e=>e.name===key);return item?item.group:'Other'};
const all=logs=>{
 const byKey=new Map(records.map(item=>[normalize(item.name),{...item,known:true}]));
 for(const row of logs||[]){if(!row||typeof row.exercise!=='string'||!row.exercise.trim())continue;
  const name=canonical(row.exercise),key=normalize(name);
  if(!byKey.has(key))byKey.set(key,{name,group:groupFor(name),known:false});
 }
 return [...byKey.values()];
};
window.RepTrackExerciseLibrary={groups,records,normalize,canonical,groupFor,all};
})();