const C='parage-v4-0-4';
const FILES=['./','index.html?v=4.0.3','style.css?v=4.0.3','app.js?v=4.0.3','manifest.json?v=4.0.3','app-logo.png?v=4.0.3','icon-192.png?v=4.0.3','icon-512.png?v=4.0.3','apple-touch-icon.png?v=4.0.3','favicon.png?v=4.0.3','assets/logo-gds.png','assets/logo-gds.jpg','clients.json','historical_jobs_2025_2026.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html?v=4.0.3'))));
});
