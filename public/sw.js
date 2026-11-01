const CACHE='vini-master-shell-v16';
const ASSETS=['/','/styles.css','/mobile-live.css','/app.js','/projects.js','/pwa.js','/jarvis.css','/jarvis.js','/live-monitor.js','/evidence.js','/vercel-console.js','/chat-threads.js','/chat-threads.css','/model-picker.js','/model-picker.css','/vini-control.js','/vini-control.css','/vini-reference.js','/vini-reference.css','/ref-office.webp','/ref-neural.webp','/ref-robot.webp','/ref-lighthouse.webp','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('vini-master-shell-')&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok&&!url.searchParams.has('token')){
   const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{}));
  }
  return response;
 }).catch(()=>caches.match(req).then(cache=>cache||caches.match('/'))));
});