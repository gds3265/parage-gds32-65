const C='parage-v3-2';
const FILES=['./','index.html','style.css?v=3.2','app.js?v=3.2','manifest.json','app-logo.png','icon-192.png','icon-512.png','apple-touch-icon.png','favicon.png','assets/logo-gds.png','assets/logo-gds.jpg','clients.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
