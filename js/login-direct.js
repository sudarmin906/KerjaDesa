/* KerjaDesa login compatibility shim V34.
 * Server-backed authentication only. No credentials are stored in source.
 * This file is loaded before the large application script so the login button
 * still has a working handler if another optional UI module fails to initialize.
 */
(function(){
  function setMsg(text){
    var el=document.getElementById('loginMsg');
    if(el) el.textContent=text||'';
  }

  function ensureAuthModule(){
    if(window.KerjaDesaAuthAPI?.login) return Promise.resolve(true);
    return new Promise(function(resolve,reject){
      var existing=document.querySelector('script[data-kd-auth-loader="1"]');
      if(existing){
        existing.addEventListener('load',function(){resolve(!!window.KerjaDesaAuthAPI?.login);},{once:true});
        existing.addEventListener('error',function(){reject(new Error('Modul autentikasi gagal dimuat.'));},{once:true});
        return;
      }
      var script=document.createElement('script');
      script.src='js/api-auth.js?v=3';
      script.async=false;
      script.dataset.kdAuthLoader='1';
      script.onload=function(){
        if(window.KerjaDesaAuthAPI?.login) resolve(true);
        else reject(new Error('Modul autentikasi belum tersedia.'));
      };
      script.onerror=function(){reject(new Error('Modul autentikasi gagal dimuat.'));};
      document.head.appendChild(script);
    });
  }

  async function fallbackLogin(){
    var user=(document.getElementById('user')?.value||'').trim();
    var pass=document.getElementById('pass')?.value||'';
    if(!user||!pass){setMsg('Username dan password wajib diisi.');return;}
    setMsg('Menyiapkan autentikasi...');
    try{
      await ensureAuthModule();
    }catch(e){
      console.warn('Modul autentikasi gagal dimuat:',e);
      setMsg(e?.message||'Modul autentikasi belum siap. Muat ulang aplikasi.');
      return;
    }
    if(!window.KerjaDesaAuthAPI?.login){
      setMsg('Modul autentikasi belum siap. Muat ulang aplikasi.');
      return;
    }
    setMsg('Menghubungkan ke server...');
    try{
      await window.KerjaDesaAuthAPI.login(user,pass);
      setMsg('Login berhasil. Membuka KerjaDesa...');
      if(typeof window.show==='function') window.show();
      else window.location.reload();
    }catch(e){
      console.warn('Login server gagal:',e);
      setMsg(e?.message||'Login gagal. Periksa koneksi dan akun.');
    }
  }

  function bind(){
    var btn=document.getElementById('loginBtn');
    if(!btn||btn.dataset.kdDirectBound==='1')return;
    btn.dataset.kdDirectBound='1';
    btn.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if(typeof window.doLogin==='function'){
        Promise.resolve(window.doLogin()).catch(function(e){
          console.warn('doLogin gagal:',e);
          fallbackLogin();
        });
      }else{
        fallbackLogin();
      }
    },true);

    var pass=document.getElementById('pass');
    if(pass&&!pass.dataset.kdDirectEnterBound){
      pass.dataset.kdDirectEnterBound='1';
      pass.addEventListener('keydown',function(ev){
        if(ev.key==='Enter'){
          ev.preventDefault();
          btn.click();
        }
      },true);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
