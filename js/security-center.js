/* KerjaDesa Security Center V34 */
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function set(id,value){const el=document.getElementById(id);if(el)el.innerHTML=value}
  function card(title,status,detail,icon){
    const ok=status==='OK', warn=status==='WARN';
    return '<div class="kd-sec-card '+(ok?'ok':warn?'warn':'bad')+'"><div class="kd-sec-icon">'+icon+'</div><div class="kd-sec-main"><div class="kd-sec-title">'+esc(title)+'</div><div class="kd-sec-status">'+(ok?'TERLINDUNGI':warn?'PERLU PERHATIAN':'BELUM TERSEDIA')+'</div><div class="kd-sec-detail">'+esc(detail)+'</div></div></div>';
  }
  async function run(){
    set('kdSecRunStatus','Memeriksa lapisan keamanan...');
    const checks=[];
    checks.push(['HTTPS / Secure Context',window.isSecureContext?'OK':'WARN',window.isSecureContext?'Koneksi berjalan pada secure context.':'Aplikasi tidak berjalan pada secure context.', '🔒']);
    const noAuthToken=!localStorage.getItem('kd_auth_token')&&!sessionStorage.getItem('kd_auth_token');
    checks.push(['Session Cookie',noAuthToken?'OK':'WARN',noAuthToken?'Session identifier tidak disimpan sebagai token browser.':'Ditemukan token legacy di storage.', '🍪']);
    const csrf=!!sessionStorage.getItem('kd_csrf_token');
    checks.push(['CSRF Protection',csrf?'OK':'WARN',csrf?'CSRF token aktif untuk request state-changing.':'CSRF token belum tersedia; login ulang jika diperlukan.', '🛡️']);
    const vault=window.KerjaDesaSecureStorage?await window.KerjaDesaSecureStorage.status():{available:false};
    checks.push(['Secure Offline Vault',vault.encrypted?'OK':vault.legacy?'WARN':'WARN',vault.encrypted?'Data kerja offline tersimpan terenkripsi AES-256-GCM.':vault.legacy?'Data lokal lama terdeteksi dan akan dimigrasikan setelah akses aplikasi.':'Vault belum berisi data kerja.', '🗄️']);
    let apiOk=false,apiDetail='API belum diperiksa.';
    try{
      const r=await fetch((window.KERJADESA_API_BASE||'/api')+'/health',{credentials:'include',cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      apiOk=r.ok;
      apiDetail=r.ok?'Backend API merespons; database: '+String(j.database?.status||j.database||'tersedia'):'HTTP '+r.status;
    }catch(e){apiDetail='API tidak dapat dijangkau dari perangkat ini.'}
    checks.push(['Backend / API',apiOk?'OK':'WARN',apiDetail,'⚙️']);
    const sw='serviceWorker' in navigator;
    checks.push(['Service Worker',sw?'OK':'WARN',sw?'Kontrol cache aplikasi tersedia.':'Service Worker tidak tersedia pada browser ini.','📦']);
    set('kdSecCards',checks.map(x=>card(x[0],x[1],x[2],x[3])).join(''));

    const user=JSON.parse(sessionStorage.getItem('kd_user')||'{}');
    set('kdSecIdentity','<b>'+esc(user.nama_lengkap||user.username||'Pengguna')+'</b> · Role: <b>'+esc(user.role||'-')+'</b> · Scope Desa: <b>'+esc(user.desa||'Tidak ditentukan')+'</b>');
    set('kdSecStorage','Vault: '+(vault.encrypted?'AES-256-GCM aktif':'belum aktif')+' · LocalStorage auth token: '+(noAuthToken?'tidak ada':'terdeteksi'));
    set('kdSecRunStatus','Pemeriksaan selesai · '+new Date().toLocaleString('id-ID'));
    await loadAudit();
  }

  async function loadAudit(){
    const el=document.getElementById('kdSecAudit');if(!el)return;
    const user=JSON.parse(sessionStorage.getItem('kd_user')||'{}');
    if(user.role!=='ADMIN'){
      el.innerHTML='<div class="kd-sec-log muted">Log keamanan server hanya dapat dilihat ADMIN. Aktivitas Anda tetap dicatat oleh server sesuai kebijakan audit.</div>';
      return;
    }
    try{
      const out=await window.KerjaDesaAPI.get('audit_log');
      const rows=(out.data||[]).slice(0,12);
      el.innerHTML=rows.length?rows.map(x=>'<div class="kd-sec-log"><span class="kd-sec-dot"></span><div><b>'+esc(x.action||'EVENT')+'</b> · '+esc(x.resource||'-')+'<br><small>'+esc(x.created_at||x.timestamp||'-')+' · '+esc(x.username||x.user||'server')+'</small></div></div>').join(''):'<div class="kd-sec-log muted">Belum ada audit event.</div>';
    }catch(e){el.innerHTML='<div class="kd-sec-log muted">Audit log belum dapat dimuat.</div>'}
  }

  async function clearLocalData(){
    const ok=confirm('Hapus DATA KERJA OFFLINE dari perangkat ini? Pastikan semua data sudah tersinkron/backup. Pengaturan aplikasi tidak ikut dihapus.');
    if(!ok)return;
    try{
      if(window.KerjaDesaSecureStorage)await window.KerjaDesaSecureStorage.clearData();
      window.kdClearSensitiveCache?.();
      window.data={kegiatan:[],monitoring:[],gps:null,docs:{}};
      alert('Data kerja offline telah dihapus dari perangkat.');
      location.reload();
    }catch(e){alert('Gagal menghapus data offline: '+e.message)}
  }

  window.kdRunSecurityCenter=run;
  window.kdClearLocalSecureData=clearLocalData;
  window.kdOpenSecurityCenter=function(){if(typeof page==='function')page('security')};
  document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('kdSecCards'))setTimeout(run,300)});
})();
