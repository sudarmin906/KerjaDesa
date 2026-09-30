/*
 CONNECT-04 - KerjaDesa Frontend Integration Bridge
 V30: server-backed data hydration + offline-safe local state.
*/
(function(){
  const api = window.KerjaDesaAPI;

  async function hydrate(){
    if(!api || !localStorage.getItem('kd_auth_token')) return {online:false};
    try{
      const [activities, monitoring] = await Promise.all([
        api.get('kegiatan'),
        api.get('monitoring')
      ]);
      const local = JSON.parse(localStorage.getItem('kerjadesa') || '{"kegiatan":[],"monitoring":[],"gps":null,"docs":{}}');
      local.kegiatan = activities.data || [];
      local.monitoring = monitoring.data || [];
      localStorage.setItem('kerjadesa', JSON.stringify(local));
      return {online:true, kegiatan:local.kegiatan.length, monitoring:local.monitoring.length};
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
        authenticated:!!localStorage.getItem('kd_auth_token'),
        online:navigator.onLine
      };
    },
    hydrate
  };

  window.addEventListener('online', () => hydrate().then(result => {
    if(result.online && typeof window.kdRefresh === 'function') window.kdRefresh();
  }));
})();
