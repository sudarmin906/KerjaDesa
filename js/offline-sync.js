/*
 * KerjaDesa Offline Sync Engine V31
 * Durable local queue, retry/backoff, conflict visibility and online reconciliation.
 */
(function(){
  const QUEUE_KEY='kd_sync_queue_v31';
  const META_KEY='kd_sync_meta_v31';
  const MAX_ATTEMPTS=8;
  const api=window.KerjaDesaAPI;

  function readQueue(){
    try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch(e){return[]}
  }
  function writeQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q));return q}
  function now(){return new Date().toISOString()}
  function uid(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))}
  function enqueue(resource,operation,payload,localId,meta={}){
    const q=readQueue();
    const existing=q.find(x=>x.resource===resource&&x.operation===operation&&String(x.localId)===String(localId)&&x.status!=='SYNCED');
    if(existing){existing.payload=payload;existing.updatedAt=now();existing.meta=meta;writeQueue(q);return existing}
    const item={id:uid(),resource,operation,localId:String(localId),payload,meta,createdAt:now(),updatedAt:now(),status:'PENDING',attempts:0,lastError:'',serverId:null};
    q.push(item);writeQueue(q);renderStatus();return item
  }
  function mark(id,patch){
    const q=readQueue(),i=q.findIndex(x=>x.id===id);if(i<0)return null;
    q[i]=Object.assign({},q[i],patch,{updatedAt:now()});writeQueue(q);return q[i]
  }
  function remove(id){writeQueue(readQueue().filter(x=>x.id!==id));renderStatus()}
  function remapQueuedReferences(resource,localId,serverId){
    if(!serverId)return;
    const q=readQueue();let changed=false;
    q.forEach(x=>{
      if(x.id && x.resource===resource && String(x.localId)===String(localId) && x.operation!=='CREATE' && String(x.serverId||'')!==String(serverId)){
        x.serverId=serverId;x.updatedAt=now();changed=true;
      }
    });
    if(changed)writeQueue(q);
  }
  function pending(){return readQueue().filter(x=>['PENDING','FAILED'].includes(x.status))}
  function backoff(attempts){return Math.min(30000,1000*Math.pow(2,Math.max(0,attempts-1)))}

  async function processQueue(){
    if(!api||!sessionStorage.getItem('kd_auth_token')||!navigator.onLine)return {processed:0,conflicts:0,failed:0};
    let processed=0,conflicts=0,failed=0;
    for(const item of pending()){
      if(item.attempts>=MAX_ATTEMPTS){failed++;continue}
      mark(item.id,{status:'SYNCING',attempts:item.attempts+1});
      try{
        let result;
        if(item.operation==='CREATE'){
          if(item.resource==='sppd'){
            const existingRows=(await api.get('sppd')).data||[];
            const uid=String(item.payload?.user_id||'local');
            const existing=existingRows.find(x=>String(x.user_id||'')===uid);
            result=existing?await api.update('sppd',existing.id,item.payload):await api.create(item.resource,item.payload);
          }else result=await api.create(item.resource,item.payload);
        }
        else if(item.operation==='UPDATE') result=await api.update(item.resource,item.serverId||item.localId,item.payload);
        else if(item.operation==='DELETE'){await api.remove(item.resource,item.serverId||item.localId);result={data:null}}
        else throw new Error('Operasi sinkronisasi tidak dikenal.');
        const server=result.data||null;
        mark(item.id,{status:'SYNCED',serverId:server?.id||item.serverId||item.localId,lastError:'',syncedAt:now()});
        if(server){
          remapQueuedReferences(item.resource,item.localId,server.id);
          if(window.KerjaDesaOfflineSync?.applyServerRecord) window.KerjaDesaOfflineSync.applyServerRecord(item.resource,item.localId,server);
        }
        processed++;
      }catch(error){
        if(error.status===409){
          mark(item.id,{status:'CONFLICT',lastError:error.message,serverId:error.data?.server_id||item.serverId||null,conflict:error.data||{}});
          conflicts++;continue;
        }
        const current=readQueue().find(x=>x.id===item.id);
        mark(item.id,{status:(current?.attempts||item.attempts)>=MAX_ATTEMPTS?'FAILED':'PENDING',lastError:error.message});
        failed++;
        await new Promise(r=>setTimeout(r,backoff(item.attempts)));
      }
    }
    compact();
    renderStatus();
    return {processed,conflicts,failed}
  }

  function compact(){
    const q=readQueue();
    const cutoff=Date.now()-7*24*60*60*1000;
    writeQueue(q.filter(x=>x.status!=='SYNCED'||new Date(x.updatedAt).getTime()>cutoff));
  }

  function applyServerRecord(resource,localId,server){
    try{
      const key='kerjadesa',local=JSON.parse(localStorage.getItem(key)||'{"kegiatan":[],"monitoring":[],"gps":null,"docs":{},"syncMeta":{}}');
      if(!Array.isArray(local[resource]))return;
      const i=local[resource].findIndex(x=>String(x.id)===String(localId)||String(x.id)===String(server.id));
      if(i>=0)local[resource][i]=Object.assign({},local[resource][i],server,{synced:true,serverId:server.id});
      localStorage.setItem(key,JSON.stringify(local));
      try{
        const domain=JSON.parse(localStorage.getItem('kd_domain_cache_v1')||'{}');
        if(Array.isArray(domain[resource])){
          const di=domain[resource].findIndex(x=>String(x.id)===String(localId)||String(x.serverId||'')===String(localId));
          if(di>=0) domain[resource][di]=Object.assign({},domain[resource][di],server,{synced:true,serverId:server.id});
          else domain[resource].unshift(Object.assign({},server,{synced:true,serverId:server.id}));
          localStorage.setItem('kd_domain_cache_v1',JSON.stringify(domain));
        }
      }catch(e){}
    }catch(e){}
  }

  function resolveConflict(id,strategy){
    const item=readQueue().find(x=>x.id===id);if(!item)return null;
    if(strategy==='server'){remove(id);return {resolved:true,strategy}}
    if(strategy==='local'){
      const payload=Object.assign({},item.payload);
      delete payload.base_version;
      const q=readQueue();const i=q.findIndex(x=>x.id===id);
      q[i]=Object.assign({},q[i],{payload,status:'PENDING',attempts:0,lastError:'',conflict:null,updatedAt:now()});
      writeQueue(q);processQueue();return {resolved:true,strategy}
    }
    return {resolved:false}
  }

  function renderStatus(){
    const q=readQueue(),el=document.getElementById('kdSyncStatus');
    if(el){
      const counts={pending:0,syncing:0,conflict:0,failed:0,synced:0};
      q.forEach(x=>{const k=x.status.toLowerCase();if(k in counts)counts[k]++});
      el.innerHTML='🟢 Online Sync · Menunggu: <b>'+counts.pending+'</b> · Konflik: <b>'+counts.conflict+'</b> · Gagal: <b>'+counts.failed+'</b>';
    }
  }

  function status(){
    const q=readQueue();
    return {online:navigator.onLine,queue:q, pending:q.filter(x=>x.status==='PENDING').length,conflicts:q.filter(x=>x.status==='CONFLICT').length,failed:q.filter(x=>x.status==='FAILED').length}
  }

  window.KerjaDesaOfflineSync={version:'V31',enqueue,processQueue,status,resolveConflict,renderStatus,applyServerRecord,readQueue};
  window.addEventListener('online',()=>setTimeout(processQueue,500));
  window.addEventListener('load',()=>{renderStatus();if(navigator.onLine)setTimeout(processQueue,800)});
})();
