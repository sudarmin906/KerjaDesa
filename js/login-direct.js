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
      script.src='js/api-auth.js?v=20261004auth04';
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
    // Canonical compatibility path: this is still the real server-backed
    // authentication flow, not an offline/mock login. It exists only when the
    // main inline controller is unavailable during page bootstrap.
    var user=(document.getElementById('user')?.value||'').trim();
    var pass=document.getElementById('pass')?.value||'';
    var remember=!!document.getElementById('rememberMe')?.checked;
    if(!user||!pass){setMsg('Username dan password wajib diisi.');return false;}
    setMsg('Menghubungkan ke server...');
    try{
      await ensureAuthModule();
      var api=window.KerjaDesaAuthAPI;
      if(!api?.login) throw Object.assign(new Error('Modul autentikasi belum tersedia.'),{code:'AUTH_CLIENT_UNAVAILABLE'});
      if(window.kdAuthTrace)window.kdAuthTrace('LOGIN FALLBACK STARTED',{username_present:true,remember_me:remember});
      var result=await api.login(user,pass,remember);
      if(!result?.success) throw Object.assign(new Error(result?.message||'Login gagal.'),{code:result?.code||'AUTH_UNKNOWN_ERROR',status:result?.status||0});
      if(window.kdAuthTrace)window.kdAuthTrace('LOGIN FALLBACK RESPONSE',{success:true,user_present:!!result.user,session_present:!!result.csrf_token,remember_me:!!result.remember_me});
      
      // Never trust the login response alone. Validate the HttpOnly session
      // with the same /auth/me endpoint used by the primary controller.
      setMsg('Login berhasil. Memverifikasi session...');
      var verified=await api.me();
      if(!verified) throw Object.assign(new Error('Login berhasil tetapi session gagal dibuat. Silakan coba lagi.'),{code:'AUTH_SESSION_VERIFY_FAILED'});
      sessionStorage.setItem('kd_login','1');
      sessionStorage.setItem('kd_user',JSON.stringify(verified));
      sessionStorage.removeItem('kd_logged_out');
      if(window.KerjaDesaAuthState&&typeof window.kdSetAuthState==='function'){
        window.kdSetAuthState('AUTHENTICATED',verified);
      }else if(window.KerjaDesaAuthState){
        window.KerjaDesaAuthState.status='AUTHENTICATED';
        window.KerjaDesaAuthState.user=verified;
      }
      if(window.kdAuthTrace)window.kdAuthTrace('AUTH FALLBACK STATE UPDATED',{status:'AUTHENTICATED',role:verified?.role||'',user_id_present:verified?.id!=null});
      
      // Do not reload the page. Enter the existing protected application UI
      // and let its existing dashboard hydration run.
      if(typeof window.kdEnterAppUI!=='function') throw Object.assign(new Error('UI aplikasi belum selesai diinisialisasi.'),{code:'AUTH_UI_NOT_READY'});
      if(!window.kdEnterAppUI()) throw Object.assign(new Error('Transisi ke KerjaDesa gagal.'),{code:'AUTH_UI_TRANSITION_FAILED'});
      if(window.kdAuthTrace)window.kdAuthTrace('NAVIGATION TO DASHBOARD',{route:'home',source:'compatibility'});
      if(typeof window.show!=='function') throw Object.assign(new Error('Dashboard belum selesai diinisialisasi.'),{code:'AUTH_DASHBOARD_NOT_READY'});
      await window.show();
      setMsg('');
      if(window.kdAuthTrace)window.kdAuthTrace('DASHBOARD LOAD COMPLETE',{authenticated:sessionStorage.getItem('kd_login')==='1',source:'compatibility'});
      return true;
    }catch(e){
      console.warn('Login server gagal:',e?.code||e?.message||e);
      if(window.kdAuthTrace)window.kdAuthTrace('LOGIN FALLBACK FAILED',{code:e?.code||'',status:e?.status||0});
      var code=e?.code||'';
      if(code==='AUTH_INVALID_CREDENTIALS'||e?.status===401)setMsg('Username atau password salah.');
      else if(code==='AUTH_NETWORK_ERROR')setMsg('Tidak dapat terhubung ke server.');
      else if(code==='AUTH_SESSION_VERIFY_FAILED')setMsg('Login berhasil tetapi session gagal dibuat. Silakan coba lagi.');
      else if(code==='AUTH_UI_NOT_READY'||code==='AUTH_DASHBOARD_NOT_READY')setMsg('Aplikasi belum selesai dimuat. Muat ulang aplikasi lalu coba lagi.');
      else setMsg(e?.message||'Server authentication sedang bermasalah. Silakan coba lagi.');
      return false;
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
