const VERSION='4.0.28';
const CACHE=`suivi-parage-v4-0-28`;
const CORE=[
  './index.html','./index.html?v=4.0.28','./style.css?v=4.0.28','./app.js?v=4.0.28',
  './manifest.json?v=4.0.28','./version.json','./app-logo.png?v=4.0.28',
  './icon-192.png?v=4.0.28','./icon-512.png?v=4.0.28','./apple-touch-icon.png?v=4.0.28','./favicon.png?v=4.0.28'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    // IMPORTANT : CacheStorage est partagé par origine GitHub Pages.
    // On ne supprime QUE les anciens caches de Suivi Parage.
    await Promise.all(keys.filter(k=>k.startsWith('suivi-parage-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(c=>c.postMessage({type:'PARAGE_VERSION_READY',version:VERSION}));
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  // HTML/navigation/version : réseau d'abord pour voir une nouvelle version tout de suite.
  if(event.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/version.json')){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:'no-store'});
        if(fresh&&fresh.ok){const cache=await caches.open(CACHE);cache.put(event.request,fresh.clone());}
        return fresh;
      }catch(e){
        return (await caches.match(event.request)) || (await caches.match('./index.html')) || (await caches.match('./index.html?v=4.0.28')) || Response.error();
      }
    })());
    return;
  }

  // Ressources statiques : réseau d'abord, cache en secours.
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(event.request,{cache:'no-store'});
      if(fresh&&fresh.ok){const cache=await caches.open(CACHE);cache.put(event.request,fresh.clone());}
      return fresh;
    }catch(e){return (await caches.match(event.request))||Response.error();}
  })());
});
