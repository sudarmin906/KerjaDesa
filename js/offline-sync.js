/*
 * KerjaDesa Offline Sync Engine V31.1 Secure
 * Durable encrypted local queue, retry/backoff, conflict visibility and online reconciliation.
 */
(function(){
  'use strict';
  const QUEUE_KEY='kd_sync_queue_v31',META_KEY='kd_sync_meta_v31',QUEUE_NAME='offline-sync-queue-v31',MAX_ATTEMPTS=8;
  const api=window.KerjaDesaAPI,vault=()=>window.KerjaDesaSecureStorage;
  let queueCache=[],queueReady=false,queueLoadPromise=null;
  async function ensureQueue(){
    if(queueReady)return queueCache;
    if(!queueLoadPromise)queueLoadPromise=(async()=>{
      if(!vault()?.loadNamed)throw new Error('Secure Offline Vault tidak tersedia; antrean offline tidak disimpan dalam plaintext.');
      queueCache=await vault().loadNamed(QUEUE_NAME,null);
      if(!Array.isArray(queueCache)){
        let legacy=[];
        try{legacy=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch(e){legacy=[]}
        queueCache=Array.isArray(legacy)?legacy:[];
        if(queueCache.length)await vault().saveNamed(QUEUE_NAME,queueCache);
      }
      queueCache=queueCache||[];queueReady=true;
      try{localStorage.removeItem(QUEUE_KEY);localStorage.removeItem(META_KEY);localStorage.removeItem('kd_domain_cache_v1')}catch(e){}
      return queueCache;
    })();
    return queueLoadPromise;
  }
  function readQueue(){return queueCache}
  async function writeQueue(q){
    queueCache=Array.isArray(q)?q:[];
    if(!vault()?.saveNamed)throw new Error('Secure Offline Vault tidak tersedia.');
    await vault().saveNamed(QUEUE_NAME,queueCache);return queueCache;
  }
  const now=()=>new Date().toISOString();
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  async function enqueue(resource,operation,payload,localId,meta={}){
    await ensureQueue();const q=readQueue();
    const existing=q.find(x=>x.resource===resource&&x.operation===operation&&String(x.localId)===String(localId)&&x.status!=='SYNCED');
    if(existing){existing.payload=payload;existing.updatedAt=now();existing.meta=meta;await writeQueue(q);renderStatus();return existing}
    const item={id:uid(),resource,operation,localId:String(localId),payload,meta,createdAt:now(),updatedAt:now(),status:'PENDING',attempts:0,lastError:'',serverId:null};
    q.push(item);await writeQueue(q);renderStatus();return item;
  }
  async function mark(id,patch){
    await ensureQueue();const q=readQueue(),i=q.findIndex(x=>x.id===id);if(i<0)return null;
    q[i]=Object.assign({},q[i],patch,{updatedAt:now()});await writeQueue(q);return q[i];
  }
  async function remove(id){await ensureQueue();await writeQueue(readQueue().filter(x=>x.id!==id));renderStatus()}
  async function remapQueuedReferences(resource,localId,serverId){
    if(!serverId)return;await ensureQueue();const q=readQueue();let changed=false;
    q.forEach(x=>{if(x.id&&x.resource===resource&&String(x.localId)===String(localId)&&x.operation!=='CREATE'&&String(x.serverId||'')!==String(serverId)){x.serverId=serverId;x.updatedAt=now();changed=true}});
    if(changed)await writeQueue(q);
  }
  async function pending(){await ensureQueue();return readQueue().filter(x=>['PENDING','FAILED'].includes(x.status))}
  const backoff=a=>Math.min(30000,1000*Math.pow(2,Math.max(0,a-1)));
  async function processQueue(){
    if(!api||!sessionStorage.getItem('kd_login')||!navigator.onLine)return {processed:0,conflicts:0,failed:0};
    let processed=0,conflicts=0,failed=0;
    for(const item of await pending()){
      if(item.attempts>=MAX_ATTEMPTS){failed++;continue}
      await mark(item.id,{status:'SYNCING',attempts:item.attempts+1});
      try{
        let result;
        if(item.operation==='CREATE'){
          if(item.resource==='sppd'){
            const rows=(await api.get('sppd')).data||[],uidValue=String(item.payload?.user_id||'local');
            const existing=rows.find(x=>String(x.user_id||'')===uidValue);
            result=existing?await api.update('sppd',existing.id,item.payload):await api.create(item.resource,item.payload);
          }else result=await api.create(item.resource,item.payload);
        }else if(item.operation==='UPDATE')result=await api.update(item.resource,item.serverId||item.localId,item.payload);
        else if(item.operation==='DELETE'){await api.remove(item.resource,item.serverId||item.localId);result={data:null}}
        else throw new Error('Operasi sinkronisasi tidak dikenal.');
        const server=result.data||null;
        await mark(item.id,{status:'SYNCED',serverId:server?.id||item.serverId||item.localId,lastError:'',syncedAt:now()});
        if(server){await remapQueuedReferences(item.resource,item.localId,server.id);if(window.KerjaDesaOfflineSync?.applyServerRecord)window.KerjaDesaOfflineSync.applyServerRecord(item.resource,item.localId,server)}
        processed++;
      }catch(error){
        if(error.status===409){await mark(item.id,{status:'CONFLICT',lastError:error.message,serverId:error.data?.server_id||item.serverId||null,conflict:error.data||{}});conflicts++;continue}
        const current=readQueue().find(x=>x.id===item.id);
        await mark(item.id,{status:(current?.attempts||item.attempts)>=MAX_ATTEMPTS?'FAILED':'PENDING',lastError:error.message});failed++;
        await new Promise(r=>setTimeout(r,backoff(item.attempts)));
      }
    }
    await compact();renderStatus();return {processed,conflicts,failed};
  }
  async function compact(){await ensureQueue();const cutoff=Date.now()-7*24*60*60*1000;await writeQueue(readQueue().filter(x=>x.status!=='SYNCED'||new Date(x.updatedAt).getTime()>cutoff))}
  function applyServerRecord(resource,localId,server){
    try{
      const local=window.data;if(!Array.isArray(local?.[resource]))return;
      const i=local[resource].findIndex(x=>String(x.id)===String(localId)||String(x.id)===String(server.id));
      if(i>=0)local[resource][i]=Object.assign({},local[resource][i],server,{synced:true,serverId:server.id});
      if(vault())vault().save(local).catch(()=>{});
      try{localStorage.removeItem('kd_domain_cache_v1')}catch(e){}
    }catch(e){}
  }
  async function resolveConflict(id,strategy){
    await ensureQueue();const item=readQueue().find(x=>x.id===id);if(!item)return null;
    if(strategy==='server'){await remove(id);return {resolved:true,strategy}}
    if(strategy==='local'){
      const payload=Object.assign({},item.payload);delete payload.base_version;const q=readQueue(),i=q.findIndex(x=>x.id===id);
      q[i]=Object.assign({},q[i],{payload,status:'PENDING',attempts:0,lastError:'',conflict:null,updatedAt:now()});
      await writeQueue(q);await processQueue();return {resolved:true,strategy};
    }
    return {resolved:false};
  }
  function renderStatus(){
    const q=readQueue(),el=document.getElementById('kdSyncStatus');if(!el)return;
    const counts={pending:0,syncing:0,conflict:0,failed:0,synced:0};q.forEach(x=>{const k=String(x.status||'').toLowerCase();if(k in counts)counts[k]++});
    el.textContent='🟢 Online Sync · Menunggu: '+counts.pending+' · Konflik: '+counts.conflict+' · Gagal: '+counts.failed;
  }
  function status(){const q=readQueue();return {online:navigator.onLine,queue:q,pending:q.filter(x=>x.status==='PENDING').length,conflicts:q.filter(x=>x.status==='CONFLICT').length,failed:q.filter(x=>x.status==='FAILED').length}}
  window.KerjaDesaOfflineSync={version:'V31.1-secure',enqueue,processQueue,status,resolveConflict,renderStatus,applyServerRecord,readQueue,ensureQueue};
  window.addEventListener('online',()=>setTimeout(()=>processQueue().catch(()=>{}),500));
  window.addEventListener('load',async()=>{try{await ensureQueue();renderStatus();if(navigator.onLine)setTimeout(()=>processQueue().catch(()=>{}),800)}catch(e){console.warn('Secure offline queue:',e.message)}});
})();