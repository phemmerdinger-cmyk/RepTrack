const VERSION='reptrack-shell-v10';
const FILES=['/','/app.css','/future.css','/analytics.css','/workout.css','/plan-data.js','/exercise-library.js','/app.js','/future.js','/analytics.js','/workout.js','/experiments.css','/experiments.js','/whoop-sync.css','/whoop-sync.js','/favicon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(async cache=>{await Promise.allSettled(FILES.map(path=>cache.add(path)))}));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(VERSION);cache.put(request,response.clone()).catch(()=>{})}return response}).catch(async()=>await caches.match(request)||await caches.match('/')));
});
