/* KerjaDesa direct login fallback.
   Deliberately independent of API, inline handlers, and service-worker state.
*/
(function(){
  function loginLocal(){
    var user=document.getElementById('user');
    var pass=document.getElementById('pass');
    var msg=document.getElementById('loginMsg');
    var u=(user&&user.value||'').trim();
    var pw=(pass&&pass.value)||'';
    if(!u||!pw){
      if(msg)msg.textContent='Username dan password wajib diisi.';
      return false;
    }
    if(u!=='admin'||pw!=='admin123'){
      if(msg)msg.textContent='Username atau password salah.';
      return false;
    }
    try{
      localStorage.setItem('kd_login','1');
      localStorage.removeItem('kd_auth_token');
      localStorage.setItem('kd_user',JSON.stringify({
        username:'admin',
        role:'ADMIN',
        name:'Administrator KerjaDesa',
        offline:true
      }));
    }catch(e){
      if(msg)msg.textContent='Penyimpanan login di perangkat ditolak browser.';
      return false;
    }
    if(msg)msg.textContent='✓ Login berhasil.';
    var login=document.getElementById('login');
    var app=document.getElementById('app');
    var nav=document.getElementById('nav');
    if(login)login.style.display='none';
    if(app)app.style.display='block';
    if(nav)nav.classList.remove('hide');
    try{
      if(typeof render==='function')render();
      if(typeof kdLoadServerDashboard==='function')kdLoadServerDashboard();
    }catch(e){console.warn('Dashboard render:',e)}
    return false;
  }

  function bind(){
    var btn=document.getElementById('loginBtn');
    if(!btn)return;
    if(btn.dataset.kdDirectBound==='1')return;
    btn.dataset.kdDirectBound='1';
    btn.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      loginLocal();
    },true);
    var pass=document.getElementById('pass');
    if(pass)pass.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'){
        ev.preventDefault();
        loginLocal();
      }
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
  else bind();
  window.KerjaDesaDirectLogin=loginLocal;
})();