const CACHE='kerjadesa-v64-secure-offline-queue';
const ASSETS=['./','./index.html','./manifest.json','./foto_profil.jpg','./jszip.min.js','./template_sppd_asli.docx','./js/login-direct.js','./js/report-master-v2.js?v=55','./js/security-hardening.js?v=1','./js/secure-storage.js?v=1','./js/security-center.js?v=1','./js/offline-sync.js?v=secure'];
const CACHEABLE=new Set(ASSETS.map(x=>new URL(x,self.location.href).pathname));
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request,u=new URL(req.url);
  // Never cache API, authenticated data, uploads or arbitrary same-origin GET responses.
  if(req.method!=='GET'||u.pathname.startsWith('/api/'))return;
  if(u.origin!==self.location.origin||!CACHEABLE.has(u.pathname))return;
  e.respondWith(
    caches.match(req).then(r=>r||fetch(req).then(res=>{
      if(res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>caches.match('./')))
  );
});