/* KerjaDesa Pro — Integrated Domain Modules v1
 * Extends the existing app; does not replace existing workflows.
 * Real CRUD over existing API resources + offline queue + local cache.
 */
(function(){
  'use strict';
  const API=()=>window.KerjaDesaAPI;
  const SYNC=()=>window.KerjaDesaOfflineSync;
  const CACHE_KEY='kd_domain_cache_v1';
  const state={resource:'apbdes',rows:[],editing:null,filter:''};
  const groups=[
    {id:'planning',title:'Perencanaan',icon:'🗂️',items:[
      ['wilayah','Wilayah & Desa'],['rkpdes','RKPDes / Perencanaan']
    ]},
    {id:'finance',title:'Keuangan Desa',icon:'💰',items:[
      ['apbdes','APBDes'],['rab','RAB'],['realisasi','Realisasi & Monev'],['lpj','LPJ']
    ]},
    {id:'social',title:'Data Sosial',icon:'👥',items:[
      ['penduduk','Penduduk'],['kpm','KPM'],['blt','BLT'],['stunting','Stunting']
    ]},
    {id:'enterprise',title:'Ekonomi Desa',icon:'🏪',items:[
      ['bumdes','BUMDes'],['koperasi','Koperasi Desa Merah Putih']
    ]},
    {id:'field',title:'Lapangan & Arsip',icon:'📍',items:[
      ['gps_points','Titik GPS'],['agenda','Agenda'],['dokumen','Arsip Dokumen'],['drp','DRP']
    ]}
  ];
  const schemas={
    wilayah:[
      ['nama_desa','Nama Desa','text'],['kode_desa','Kode Desa','text'],['kecamatan','Kecamatan','text'],['kabupaten','Kabupaten','text'],['provinsi','Provinsi','text'],['status','Status','select:AKTIF|NONAKTIF']
    ],
    rkpdes:[
      ['tahun','Tahun','number'],['desa','Desa','text'],['bidang','Bidang','text'],['program','Program/Kegiatan','text'],['prioritas','Prioritas','select:TINGGI|SEDANG|RENDAH'],['pagu','Pagu Indikatif','number'],['status','Status','select:DRAFT|DIBAHAS|DITETAPKAN|SELESAI'],['catatan','Catatan','textarea']
    ],
    apbdes:[
      ['tahun','Tahun Anggaran','number'],['desa','Desa','text'],['kode_rekening','Kode Rekening','text'],['bidang','Bidang','text'],['program','Program/Kegiatan','text'],['sumber_dana','Sumber Dana','text'],['rkpdes_id','RKPDes ID','text'],['kegiatan_id','Kegiatan ID','text'],['pagu','Pagu/Anggaran','number'],['realisasi','Realisasi','number'],['progres_fisik','Progres Fisik %','number'],['status','Status','select:RENCANA|BERJALAN|SELESAI|TERTUNDA'],['keterangan','Keterangan','textarea']
    ],
    rab:[
      ['tahun','Tahun','number'],['desa','Desa','text'],['apbdes_id','APBDes ID','text'],['kegiatan_id','Kegiatan ID','text'],['kegiatan','Kegiatan','text'],['uraian','Uraian Pekerjaan/Barang','textarea'],['volume','Volume','number'],['satuan','Satuan','text'],['harga_satuan','Harga Satuan','number'],['jumlah','Jumlah','number'],['status','Status','select:DRAFT|DIPERIKSA|DISETUJUI']
    ],
    realisasi:[
      ['tanggal','Tanggal','date'],['desa','Desa','text'],['apbdes_id','APBDes ID','text'],['kegiatan_id','Kegiatan ID','text'],['kegiatan','Kegiatan','text'],['sumber_dana','Sumber Dana','text'],['nilai','Nilai Realisasi','number'],['progres_fisik','Progres Fisik %','number'],['progres_keuangan','Progres Keuangan %','number'],['status','Status Monev','select:BERJALAN|SELESAI|TERTUNDA|PERLU_TINDAK_LANJUT'],['temuan','Temuan','textarea'],['tindak_lanjut','Tindak Lanjut','textarea']
    ],
    lpj:[
      ['tahun','Tahun','number'],['desa','Desa','text'],['periode','Periode','text'],['kegiatan','Kegiatan','text'],['nilai','Nilai LPJ','number'],['status','Status','select:DRAFT|DIPERIKSA|DISETUJUI|PERLU_PERBAIKAN'],['catatan','Catatan','textarea']
    ],
    penduduk:[
      ['nik','NIK','text'],['nama','Nama Lengkap','text'],['desa','Desa','text'],['dusun','Dusun','text'],['jenis_kelamin','Jenis Kelamin','select:L|P'],['tanggal_lahir','Tanggal Lahir','date'],['status','Status','select:AKTIF|PINDAH|MENINGGAL']
    ],
    kpm:[
      ['nik','NIK','text'],['nama','Nama KPM','text'],['desa','Desa','text'],['program','Program','text'],['periode','Periode','text'],['status_verval','Status Validasi','select:VALID|PERLU_VALIDASI|TIDAK_VALID'],['catatan','Catatan','textarea']
    ],
    blt:[
      ['nik','NIK KPM','text'],['nama','Nama KPM','text'],['desa','Desa','text'],['tahun','Tahun','number'],['bulan','Bulan','text'],['nilai','Nilai Bantuan','number'],['status','Status Penyaluran','select:TERSALUR|BELUM_TERDISTRIBUSI|DITUNDA'],['keterangan','Keterangan','textarea']
    ],
    stunting:[
      ['nik','NIK Sasaran','text'],['nama','Nama','text'],['desa','Desa','text'],['kategori','Kategori','text'],['tanggal','Tanggal Intervensi','date'],['intervensi','Intervensi','textarea'],['status','Status','select:DITANGANI|MONITORING|SELESAI']
    ],
    bumdes:[
      ['desa','Desa','text'],['nama','Nama BUMDes','text'],['unit_usaha','Unit Usaha','text'],['tahun','Tahun','number'],['omzet','Omzet','number'],['status','Status','select:AKTIF|PENGEMBANGAN|TIDAK_AKTIF'],['catatan','Catatan','textarea']
    ],
    koperasi:[
      ['desa','Desa','text'],['nama','Nama Koperasi','text'],['unit','Unit/Kegiatan','text'],['tahun','Tahun','number'],['progres','Progres %','number'],['status','Status','select:PERENCANAAN|PEMBANGUNAN|BEROPERASI|MONITORING'],['catatan','Catatan','textarea']
    ],
    gps_points:[
      ['desa','Desa','text'],['nama_titik','Nama Titik','text'],['latitude','Latitude','text'],['longitude','Longitude','text'],['kegiatan_id','Kegiatan ID','text'],['keterangan','Keterangan','textarea']
    ],
    agenda:[
      ['tanggal','Tanggal','date'],['desa','Desa','text'],['judul','Judul Agenda','text'],['jenis','Jenis','text'],['lokasi','Lokasi','text'],['status','Status','select:RENCANA|BERLANGSUNG|SELESAI|BATAL'],['catatan','Catatan','textarea']
    ],
    dokumen:[
      ['desa','Desa','text'],['kategori','Kategori','select:RPJMDes|RKPDes|APBDes|RAB|REALISASI|LPJ|BA|SURAT|MONEV_DD|BUMDes|KOPERASI|LAINNYA'],['judul','Judul Dokumen','text'],['tahun','Tahun','number'],['nomor','Nomor Dokumen','text'],['status','Status','select:DRAFT|AKTIF|ARSIP'],['catatan','Catatan','textarea']
    ],
    drp:[
      ['tanggal','Tanggal','date'],['desa','Desa','text'],['kegiatan_id','Kegiatan ID','text'],['kegiatan','Kegiatan','text'],['tujuan','Tujuan Kunjungan','textarea'],['hasil','Hasil Kunjungan','textarea'],['masalah','Masalah/Temuan','textarea'],['tindak_lanjut','Tindak Lanjut','textarea'],['rekomendasi','Rekomendasi','textarea'],['status','Status','select:DRAFT|DIPERIKSA|DISETUJUI']
    ]
  };
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function money(v){return Number(v||0).toLocaleString('id-ID')}
  function cache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch(e){return {}}}
  function saveCache(c){localStorage.setItem(CACHE_KEY,JSON.stringify(c))}
  function cacheRows(r){return cache()[r]||[]}
  function setCacheRows(r,rows){const c=cache();c[r]=rows;saveCache(c)}
  function localUpsert(r,item){
    const rows=cacheRows(r),i=rows.findIndex(x=>String(x.id)===String(item.id));
    if(i>=0)rows[i]=Object.assign({},rows[i],item);else rows.unshift(item);
    setCacheRows(r,rows);return item
  }
  function localRemove(r,id){setCacheRows(r,cacheRows(r).filter(x=>String(x.id)!==String(id)))}
  function queue(op,r,payload,id){try{SYNC()?.enqueue(r,op,payload,id)}catch(e){console.warn(e)}}
  async function load(r){
    state.resource=r;
    const cached=cacheRows(r); state.rows=cached.slice();
    render();
    if(!API()||!localStorage.getItem('kd_auth_token')||!navigator.onLine)return;
    try{
      const out=await API().get(r); const rows=Array.isArray(out.data)?out.data:[];
      state.rows=rows; setCacheRows(r,rows); render();
    }catch(e){console.warn('KerjaDesa module load',r,e)}
  }
  function fields(r,item={}){
    return (schemas[r]||[]).map(([k,label,type])=>{
      const val=item[k]??'';
      if(type.startsWith('select:')){
        const opts=type.slice(7).split('|');
        return '<label>'+esc(label)+'<select data-kd-field="'+esc(k)+'"><option value="">- pilih -</option>'+opts.map(o=>'<option '+(String(o)===String(val)?'selected':'')+' value="'+esc(o)+'">'+esc(o)+'</option>').join('')+'</select></label>';
      }
      const input=type==='textarea'?'<textarea data-kd-field="'+esc(k)+'" rows="3">'+esc(val)+'</textarea>':'<input data-kd-field="'+esc(k)+'" type="'+esc(type)+'" value="'+esc(val)+'">';
      return '<label>'+esc(label)+input+'</label>';
    }).join('');
  }
  function form(){
    const r=state.resource,item=state.editing||{};
    return '<div class="card kd-domain-form"><h3>'+(state.editing?'✏️ Ubah Data':'➕ Tambah Data')+' — '+esc(label(r))+'</h3><div class="grid">'+fields(r,item)+'</div><div class="actions"><button onclick="kdDomainSave()">💾 Simpan</button><button class="secondary" onclick="kdDomainCancel()">Batal</button></div><div id="kdDomainFormStatus" class="small muted"></div></div>';
  }
  function label(r){for(const g of groups)for(const x of g.items)if(x[0]===r)return x[1];return r}
  function summary(r,rows){
    if(r==='apbdes'){
      const p=rows.reduce((a,x)=>a+Number(x.pagu||0),0),z=rows.reduce((a,x)=>a+Number(x.realisasi||0),0);
      return '<div class="grid"><div class="pill"><b>Total Pagu</b><br>Rp '+money(p)+'</div><div class="pill"><b>Total Realisasi</b><br>Rp '+money(z)+'</div><div class="pill"><b>Sisa</b><br>Rp '+money(p-z)+'</div><div class="pill"><b>Serapan</b><br>'+ (p?Math.round(z/p*100):0)+'%</div></div>';
    }
    if(r==='realisasi'){
      const v=rows.reduce((a,x)=>a+Number(x.nilai||0),0),done=rows.filter(x=>x.status==='SELESAI').length;
      return '<div class="grid"><div class="pill"><b>Total Realisasi</b><br>Rp '+money(v)+'</div><div class="pill"><b>Monev Selesai</b><br>'+done+'</div></div>';
    }
    return '<div class="pill"><b>Total '+esc(label(r))+'</b><br>'+rows.length+' data</div>';
  }
  function table(r,rows){
    const sch=schemas[r]||[], cols=sch.slice(0,5);
    return '<div class="tablewrap"><table class="simpletable"><thead><tr>'+cols.map(x=>'<th>'+esc(x[1])+'</th>').join('')+'<th>Aksi</th></tr></thead><tbody>'+rows.filter(x=>!state.filter||JSON.stringify(x).toLowerCase().includes(state.filter.toLowerCase())).slice(0,100).map(x=>'<tr>'+cols.map(c=>'<td>'+esc(String(x[c[0]]??'').slice(0,120))+'</td>').join('')+'<td><button style="width:auto" onclick="kdDomainEdit(\''+esc(x.id)+'\')">Edit</button> <button style="width:auto;background:#b42318" onclick="kdDomainDelete(\''+esc(x.id)+'\')">Hapus</button></td></tr>').join('')+'</tbody></table></div>';
  }
  function render(){
    const box=document.getElementById('kdIntegratedWorkspace');if(!box)return;
    box.querySelectorAll('[data-kd-nav]').forEach(b=>b.classList.toggle('active',b.dataset.kdNav===state.resource));
    const rows=state.rows||[];
    box.querySelector('#kdDomainBody').innerHTML=form()+summary(state.resource,rows)+'<div class="card"><div class="section-title"><h3>Data '+esc(label(state.resource))+'</h3><input style="max-width:280px" placeholder="Cari..." value="'+esc(state.filter)+'" oninput="kdDomainFilter(this.value)"></div>'+table(state.resource,rows)+'</div>';
  }
  async function save(){
    const r=state.resource,p={};
    document.querySelectorAll('[data-kd-field]').forEach(el=>{p[el.dataset.kdField]=el.value});
    const id=state.editing?.id;
    const isLocalId=id && String(id).startsWith('local-');
    try{
      let out;
      if(id&&!isLocalId&&API()&&localStorage.getItem('kd_auth_token')&&navigator.onLine)out=await API().update(r,id,p);
      else if((!id||isLocalId)&&API()&&localStorage.getItem('kd_auth_token')&&navigator.onLine)out=await API().create(r,p);
      const item=out?.data||Object.assign({id:id||('local-'+Date.now()),updated_at:new Date().toISOString()},p);
      localUpsert(r,item);
      if(!out)queue(id&&!isLocalId?'UPDATE':'CREATE',r,p,item.id);
      else setCacheRows(r,state.rows=cacheRows(r).map(x=>String(x.id)===String(item.id)?item:x));
      state.editing=null;state.rows=cacheRows(r);render();
      try{ if(typeof window.loadDashboard==='function') window.loadDashboard(); else if(typeof window.refreshDashboard==='function') window.refreshDashboard(); }catch(e){}
      toast('Data '+(id?'diperbarui':'ditambahkan')+'.');
    }catch(e){
      const item=Object.assign({id:id||('local-'+Date.now()),updated_at:new Date().toISOString()},p);
      const localId=String(item.id).startsWith('local-');
      localUpsert(r,item);queue(id&&!localId?'UPDATE':'CREATE',r,p,item.id);state.editing=null;state.rows=cacheRows(r);render();toast('Tersimpan offline; akan disinkronkan saat online.');
    }
  }
  async function del(id){
    if(!confirm('Hapus data ini?'))return;
    try{
      if(API()&&localStorage.getItem('kd_auth_token')&&navigator.onLine)await API().remove(state.resource,id);else queue('DELETE',state.resource,{},id);
    }catch(e){queue('DELETE',state.resource,{},id)}
    localRemove(state.resource,id);state.rows=cacheRows(state.resource);render();
    try{ if(typeof window.loadDashboard==='function') window.loadDashboard(); else if(typeof window.refreshDashboard==='function') window.refreshDashboard(); }catch(e){}
  }
  function toast(msg){const el=document.getElementById('kdDomainToast');if(el){el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}}
  function mount(){
    if(document.getElementById('kdIntegratedWorkspace'))return;
    if(!document.getElementById('kd-integrated-domain-css')){
      const st=document.createElement('style'); st.id='kd-integrated-domain-css';
      st.textContent='.kd-domain-nav{display:grid;gap:10px;margin:12px 0}.kd-domain-group{padding:10px;border:1px solid #e1e8eb;border-radius:14px;background:#f9fcfd}.kd-domain-group>b{display:block;margin-bottom:7px}.kd-domain-group button{width:auto;margin:3px;padding:9px 12px;font-size:12px}.kd-domain-group button.active{box-shadow:0 0 0 2px #0f766e inset}.kd-domain-form{background:#fbfdfd}.kd-domain-form label{display:block;font-size:12px;font-weight:700;color:#52616b}.kd-domain-form input,.kd-domain-form select,.kd-domain-form textarea{margin-top:4px}.kd-domain-toast{position:fixed;left:50%;bottom:95px;transform:translateX(-50%);background:#102a43;color:#fff;padding:10px 16px;border-radius:999px;opacity:0;pointer-events:none;transition:.2s;z-index:100}.kd-domain-toast.show{opacity:1}.kd-domain-nav button{background:#0f766e;color:#fff}';
      document.head.appendChild(st);
    }
    const home=document.getElementById('home');if(!home)return;
    const box=document.createElement('div');box.id='kdIntegratedWorkspace';box.className='card';
    box.innerHTML='<div class="section-title"><div><h2 style="margin:0">🧩 Pusat Kerja Terpadu</h2><span>Perencanaan → APBDes → RAB → Realisasi/Monev → Kegiatan → Monitoring → DRP → Laporan → Arsip</span></div></div><div class="kd-domain-nav">'+groups.map(g=>'<div class="kd-domain-group"><b>'+g.icon+' '+esc(g.title)+'</b><div>'+g.items.map(x=>'<button data-kd-nav="'+x[0]+'" onclick="kdDomainOpen(\''+x[0]+'\')">'+esc(x[1])+'</button>').join('')+'</div></div>').join('')+'</div><div id="kdDomainBody"></div><div id="kdDomainToast" class="kd-domain-toast"></div>';
    const anchor=document.getElementById('kdUpgradeCenter')||home.querySelector('.kd-data-center');if(anchor)anchor.before(box);else home.appendChild(box);
    load('apbdes');
  }
  window.kdDomainOpen=load;
  window.kdDomainEdit=function(id){state.editing=state.rows.find(x=>String(x.id)===String(id))||null;render();document.getElementById('kdIntegratedWorkspace')?.scrollIntoView({behavior:'smooth',block:'start'})};
  window.kdDomainCancel=function(){state.editing=null;render()};
  window.kdDomainSave=save;
  window.kdDomainDelete=del;
  window.kdDomainFilter=function(v){state.filter=v||'';render()};
  window.kdIntegratedWorkspace=mount;
  const oldShow=window.show;
  if(typeof oldShow==='function')window.show=function(){oldShow();setTimeout(mount,0)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else setTimeout(mount,0);
})();
