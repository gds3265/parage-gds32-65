const C='parage-v1-9';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','style.css','app.js','manifest.json','assets/app-logo.png','assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png','assets/logo-gds.png','clients.json'])))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
