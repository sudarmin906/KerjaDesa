const CACHE='kerjadesa-v19';
const ASSETS=['./','./index.html','./manifest.json','./icon.svg','./jszip.min.js','./template_sppd_asli.docx','./logo_sppd.jpg','./foto_profil.jpg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(e.request.method==='GET'&&r.ok){const copy=r.clone();caches.open(CACHE).then(x=>x.put(e.request,copy));}return r}).catch(()=>c)))})
