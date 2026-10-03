// KerjaDesa Pro deployment configuration.
// Keep the default /api for same-origin deployment.
// For a separately hosted API, replace the value with the API origin ending in /api.
window.KERJADESA_API_BASE = window.KERJADESA_API_BASE || 'https://kerjadesa-pro.blitz.cloud/api';
// Security default: offline admin login is disabled in production. Enable explicitly only for a controlled demo/offline build.
window.KERJADESA_ALLOW_OFFLINE_LOGIN = false;

(function(){
  var css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./css/integrated-domain-modules.css';
  document.head.appendChild(css);
  var s=document.createElement('script');
  s.src='./js/integrated-domain-modules.js';
  s.defer=true;
  s.dataset.kerjadesaIntegrated='1';
  document.head.appendChild(s);
})();
