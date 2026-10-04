/* KerjaDesa Security Hardening V33
 * Client-side defense-in-depth. Server must still enforce authentication,
 * authorization, rate limits, CSRF protection and token invalidation.
 */
(function(){
  'use strict';

  const LEGACY_KEYS=['kd_login','kd_auth_token','kd_user'];
  const AUTH_KEYS=['kd_login','kd_auth_token','kd_csrf_token','kd_user'];
  const SENSITIVE_CACHE_KEYS=['kd_sync_queue_v31','kd_sync_meta_v31','kd_domain_cache_v1'];

  function hasSession(){
    try{return sessionStorage.getItem('kd_login')==='1';}catch(e){return false;}
  }

  function clearLegacyAuth(){
    try{LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));}catch(e){}
  }

  function clearSensitiveCache(){
    try{
      SENSITIVE_CACHE_KEYS.forEach(k=>localStorage.removeItem(k));
      // Main application data has migrated to Secure Offline Vault.
      // Never rewrite it back to plaintext localStorage during cleanup.
      localStorage.removeItem('kerjadesa');
    }catch(e){console.warn('Pembersihan cache sensitif:',e)}
  }

  window.kdClearSensitiveCache=clearSensitiveCache;

  function showLogin(message){
    const login=document.getElementById('login');
    const app=document.getElementById('app');
    const nav=document.getElementById('nav');
    if(app)app.style.display='none';
    if(nav)nav.classList.add('hide');
    const account=document.querySelector('.kd-account');if(account)account.style.display='none';
    if(login)login.style.display='';
    const msg=document.getElementById('loginMsg');
    if(msg)msg.textContent=message||'Sesi tidak aktif. Silakan masuk kembali.';
  }

  function guard(){
    clearLegacyAuth();
    if(!hasSession())showLogin('Sesi tidak aktif. Silakan masuk kembali.');
  }

  function patchNavigation(){
    if(typeof window.page==='function'&&!window.page.__kdSecurityWrapped){
      const original=window.page;
      const wrapped=function(){
        if(!hasSession()){showLogin('Sesi tidak aktif. Silakan masuk kembali.');return false;}
        return original.apply(this,arguments);
      };
      wrapped.__kdSecurityWrapped=true;
      window.page=wrapped;
    }
    if(typeof window.show==='function'&&!window.show.__kdSecurityWrapped){
      const original=window.show;
      const wrapped=function(){
        if(!hasSession()){showLogin('Sesi tidak aktif. Silakan masuk kembali.');return false;}
        return original.apply(this,arguments);
      };
      wrapped.__kdSecurityWrapped=true;
      window.show=wrapped;
    }
  }

  function addSecurityPanel(){
    const host=document.getElementById('pengaturanPanel');
    if(!host||document.getElementById('kdSecurityPanel'))return;
    const card=document.createElement('div');
    card.id='kdSecurityPanel';
    card.className='kd-setting-section';
    card.innerHTML=
      '<div class="kd-setting-head"><div class="kd-setting-icon">🛡️</div><div><h3>Keamanan & Sesi</h3><p>Kontrol keamanan perangkat dan sesi KerjaDesa.</p></div></div>'+
      '<div id="kdSecurityStatus" class="ai-box"></div>'+
      '<div class="kd-setting-actions">'+
      '<button type="button" class="secondary" id="kdSecurityClearLegacy">🧹 Bersihkan Kredensial Lama</button>'+
      '<button type="button" class="kd-danger" id="kdSecurityLogout">↪ Akhiri Sesi Sekarang</button>'+
      '</div>';
    host.appendChild(card);
    const status=document.getElementById('kdSecurityStatus');
    const secure=location.protocol==='https:';
    const sw=('serviceWorker' in navigator);
    if(status){
      status.innerHTML=
        '<b>'+ (secure?'🟢 HTTPS aktif':'🔴 Gunakan HTTPS') +'</b><br>'+
        '<span class="small muted">Sesi: '+(hasSession()?'Aktif':'Tidak aktif')+
        ' • Session: HttpOnly cookie • CSRF: sessionStorage • Service Worker: '+(sw?'aktif':'tidak tersedia')+
        '</span><br><span class="small muted">Kredensial lama yang tersimpan di localStorage dibersihkan otomatis.</span>';
    }
    document.getElementById('kdSecurityClearLegacy')?.addEventListener('click',()=>{
      clearLegacyAuth();
      if(status)status.innerHTML='<b>✅ Kredensial lama dibersihkan.</b><br><span class="small muted">Token sesi tidak disimpan di localStorage.</span>';
    });
    document.getElementById('kdSecurityLogout')?.addEventListener('click',()=>window.kdLogout?.());
  }

  window.kdSecurityStatus=function(){
    return {
      authenticated:hasSession(),
      tokenStorage:'sessionStorage',
      https:location.protocol==='https:',
      serviceWorker:'serviceWorker' in navigator,
      legacyAuthCleared:(()=>{try{return !localStorage.getItem('kd_login')&&!localStorage.getItem('kd_auth_token')&&!localStorage.getItem('kd_user')}catch(e){return false}})()
    };
  };

  clearLegacyAuth();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{guard();patchNavigation();addSecurityPanel();});
  }else{
    guard();patchNavigation();addSecurityPanel();
  }
  window.addEventListener('pageshow',()=>{clearLegacyAuth();if(!hasSession())showLogin('Sesi tidak aktif. Silakan masuk kembali.');patchNavigation();});
  window.addEventListener('storage',()=>{if(!hasSession())showLogin('Sesi telah berakhir. Silakan masuk kembali.');});
})();
