// KerjaDesa Integration Bootstrap
// CONNECT-03B FINAL-A
// Menyiapkan pemuatan modul integrasi secara aman.

(function(){
  const modules = [
    'js/frontend-api-config.js',
    'js/api-auth.js',
    'js/connect-integration.js'
  ];

  window.KerjaDesaIntegration = {
    loaded: true,
    modules,
    status: 'bootstrap-ready'
  };

  console.log('KerjaDesa Integration Bootstrap Ready');
})();
