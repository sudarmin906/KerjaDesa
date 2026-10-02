/*
 CONNECT-04 - KerjaDesa Frontend Integration Bridge
 V30: server-backed data hydration + offline-safe local state.
*/
(function(){
  const api = window.KerjaDesaAPI;

  async function hydrate(){
    if(!api || !sessionStorage.getItem('kd_login')) return {online:false};
    try{
      const [activities, monitoring, villages, documents, reports] = await Promise.all([
        api.get('kegiatan'),
        api.get('monitoring'),
        api.get('desa'),
        api.get('dokumen'),
        api.get('laporan')
      ]);
      const local = JSON.parse(localStorage.getItem('kerjadesa') || '{"kegiatan":[],"monitoring":[],"gps":null,"docs":{}}');
      const serverKegiatan = activities.data || [];
      const serverMonitoring = monitoring.data || [];
      const serverDesa = villages.data || [];
      const serverDocuments = documents.data || [];
      const serverReports = reports.data || [];
      const queue = window.KerjaDesaOfflineSync?.readQueue?.() || [];
      const pending = queue.filter(x => ['PENDING','SYNCING','FAILED','CONFLICT'].includes(x.status));
      const mergePending = (serverItems, resource) => {
        const localItems = Array.isArray(local[resource]) ? local[resource] : [];
        const pendingItems = pending.filter(q => q.resource === resource).map(q => q.payload).filter(Boolean);
        const merged = serverItems.slice();
        pendingItems.forEach(item => {
          const i = merged.findIndex(x => String(x.id) === String(item.id) || String(x.serverId || '') === String(item.id));
          if (i >= 0) merged[i] = Object.assign({}, merged[i], item, { synced: false });
          else merged.push(Object.assign({}, item, { synced: false }));
        });
        localItems.filter(x => x && x.synced === false && !pendingItems.some(p => String(p.id) === String(x.id))).forEach(item => merged.push(item));
        return merged;
      };
      local.kegiatan = mergePending(serverKegiatan, 'kegiatan');
      local.monitoring = mergePending(serverMonitoring, 'monitoring');
      local.serverData = local.serverData || {};
      local.serverData.desa = serverDesa;
      local.serverData.dokumen = serverDocuments;
      local.serverData.laporan = serverReports;
      local.serverData.updatedAt = new Date().toISOString();
      localStorage.setItem('kerjadesa', JSON.stringify(local));
      window.KerjaDesaOfflineSync?.processQueue?.();
      return {online:true, kegiatan:local.kegiatan.length, monitoring:local.monitoring.length, desa:serverDesa.length, dokumen:serverDocuments.length, laporan:serverReports.length};
    }catch(error){
      console.warn('KerjaDesa hydration skipped:', error.message);
      return {online:false,error:error.message};
    }
  }

  window.KerjaDesaIntegration = {
    version: 'CONNECT-04',
    status: 'server-backed',
    api,
    check(){
      return {
        version:this.version,
        apiReady:!!this.api,
        authenticated:!!sessionStorage.getItem('kd_login'),
        online:navigator.onLine
      };
    },
    hydrate
  };

  window.addEventListener('online', () => hydrate().then(result => {
    if(result.online && typeof window.kdRefresh === 'function') window.kdRefresh();
  }));
})();
