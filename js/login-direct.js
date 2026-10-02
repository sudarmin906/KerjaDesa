/* KerjaDesa login compatibility shim V33.
 * Tidak lagi menyimpan atau menerima kredensial hardcoded.
 * Autentikasi hanya boleh berasal dari alur doLogin() server-side.
 */
(function(){
  function bind(){
    var btn=document.getElementById('loginBtn');
    if(!btn||btn.dataset.kdDirectBound==='1')return;
    btn.dataset.kdDirectBound='1';
    btn.addEventListener('click',function(ev){
      if(typeof window.doLogin==='function') return;
      ev.preventDefault();
      var msg=document.getElementById('loginMsg');
      if(msg)msg.textContent='Modul autentikasi belum siap. Muat ulang aplikasi.';
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
