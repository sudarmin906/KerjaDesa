/*
 KerjaDesa CONNECT-03A.1
 Safe frontend integration loader

 File ini disiapkan sebagai jembatan integrasi frontend ke modul API.
 Tidak mengubah modul lama secara langsung.
*/
(function(){
  window.KerjaDesaIntegration = {
    version: 'CONNECT-03A.1',
    status: 'ready',
    modules: [
      'frontend-api-config.js',
      'api-auth.js',
      'connect-integration.js'
    ]
  };

  console.log('KerjaDesa Integration Loader Ready');
})();
