/* Exact-master report engine for KerjaDesa. */
(function(){
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const A='http://schemas.openxmlformats.org/drawingml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const DB='KerjaDesaMasterTemplateDB',STORE='files',KEY='report';
  const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  function dbOpen(){
    return new Promise(function(resolve,reject){
      const q=indexedDB.open(DB,1);
      q.onupgradeneeded=function(){if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};
      q.onsuccess=function(){resolve(q.result)};q.onerror=function(){reject(q.error)};
    });
  }
  async function dbPut(blob,name){
    const db=await dbOpen();
    return new Promise(function(resolve,reject){
      const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({blob:blob,name:name||'master.docx',savedAt:Date.now()},KEY);
      tx.oncomplete=function(){db.close();resolve(true)};tx.onerror=function(){db.close();reject(tx.error)};
    });
  }
  async function dbGet(){
    const db=await dbOpen();
    return new Promise(function(resolve,reject){
      const q=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);
      q.onsuccess=function(){db.close();resolve(q.result||null)};q.onerror=function(){db.close();reject(q.error)};
    });
  }
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
  function clean(s){return String(s==null?'':s).replace(/\u00ad/g,'').replace(/\s+/g,' ').trim()}
  function xmlDoc(s){return new DOMParser().parseFromString(s,'application/xml')}
  function xmlStr(d){return new XMLSerializer().serializeToString(d)}
  function textOf(el){return Array.from(el.getElementsByTagNameNS(W,'t')).map(function(x){return x.textContent||''}).join('')}
  function bodyParagraphs(body){return Array.from(body.children).filter(function(x){return x.localName==='p'})}
  function bodyTables(body){return Array.from(body.children).filter(function(x){return x.localName==='tbl'})}
  function rows(tbl){return Array.from(tbl.children).filter(function(x){return x.localName==='tr'})}
  function cells(tr){return Array.from(tr.children).filter(function(x){return x.localName==='tc'})}
  function setParagraphText(p,text){
    if(!p)return;
    const pPr=Array.from(p.children).find(function(x){return x.localName==='pPr'});
    const fr=Array.from(p.children).find(function(x){return x.localName==='r'});
    const rPr=fr&&fr.getElementsByTagNameNS(W,'rPr')[0]?fr.getElementsByTagNameNS(W,'rPr')[0].cloneNode(true):null;
    Array.from(p.childNodes).forEach(function(n){if(n.nodeType===1&&n.localName!=='pPr')p.removeChild(n)});
    String(text==null?'':text).split('\n').forEach(function(line,i){
      if(i){const rr=p.ownerDocument.createElementNS(W,'w:r'),br=p.ownerDocument.createElementNS(W,'w:br');rr.appendChild(br);p.appendChild(rr)}
      const rr=p.ownerDocument.createElementNS(W,'w:r');if(rPr)rr.appendChild(rPr.cloneNode(true));
      const tt=p.ownerDocument.createElementNS(W,'w:t');tt.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');tt.textContent=line;rr.appendChild(tt);p.appendChild(rr);
    });
  }
  function setCellText(tc,text){
    Array.from(tc.children).forEach(function(n){if(n.localName!=='tcPr')tc.removeChild(n)});
    const p=tc.ownerDocument.createElementNS(W,'w:p');tc.appendChild(p);setParagraphText(p,text);
  }
  function clearCellDrawings(tc){Array.from(tc.getElementsByTagNameNS(W,'drawing')).forEach(function(x){if(x.parentNode)x.parentNode.removeChild(x)})}
  function dateLong(d){
    const m=String(d||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return String(d||'');
    return String(m[1]).padStart(2,'0')+' '+MONTHS[Number(m[2])-1]+' '+m[3];
  }
  function dk(d){return window.dateKey?dateKey(d):String(d||'')}
  function titleCase(s){return String(s||'').toLowerCase().replace(/\b[a-z]/g,function(c){return c.toUpperCase()})}
  function village(loc){const p=String(loc||'').split('/');return titleCase(p[p.length-1]||loc||'-')}

  function docTitle(desc){
    const d=clean(desc),l=d.toLowerCase();
    const rules=[
      [/gedung koperasi|koperasi desa merah putih/,'Monitoring Progres Pembangunan Gedung Koperasi Desa Merah Putih'],
      [/rabat beton.*jalan.*paminggalan|jalan poros paminggalan.*limbua/,'Monitoring Progres Pekerjaan Rabat Beton Jalan Poros Paminggalan menuju Desa Limbua'],
      [/jembatan dekker/,'Monitoring Progres Pembangunan Jembatan Dekker Dusun Palla-Pallang'],
      [/drainase/,'Monitoring Progres Pembangunan Drainase'],
      [/titik nol|titik 0.*rehabilitasi jalan setapak/,'Monitoring Titik Nol Rehabilitasi Jalan Setapak'],
      [/pra[- ]?musrenbang/,'Koordinasi Persiapan Pra-Musrenbang Dusun'],
      [/musrenbangdes|musyawarah.*rkpdes/,'Musrenbang Desa dalam rangka Penyusunan RKPDes dan DU-RKPDes Tahun 2027'],
      [/perubahan apbdes/,'Koordinasi Persiapan Perubahan APBDes Tahun Anggaran 2026'],
      [/rancangan apbdes/,'Koordinasi Penyusunan Rancangan APBDes'],
      [/monev.*dana desa|monitoring dan evaluasi dana desa/,'Rapat Koordinasi TPP P3MD terkait Percepatan Monev Dana Desa'],
      [/sembako|pkh|blt/,'Verifikasi dan Sinkronisasi Data Penerima Bantuan'],
      [/indeks desa|verval|pemutakhiran data/,'Verifikasi, Perbaikan dan Pemutakhiran Data Indeks Desa'],
      [/baliho.*apbdes|infografis.*apbdes/,'Koordinasi Percepatan Pemasangan Baliho/Infografis APBDes']
    ];
    for(const x of rules)if(x[0].test(l))return x[1];
    const first=d.split(/[.!?](?:\s|$)/)[0].trim();return first.length>120?first.slice(0,117).replace(/\s+\S*$/,'')+'…':first;
  }

  function has(acts,rx){return (acts||[]).some(function(a){return rx.test(String(a.deskripsi||'').toLowerCase())})}
  function narratives(acts){
    const physical=has(acts,/pembangunan|jalan|rabat|jembatan|drainase|koperasi/),plan=has(acts,/musrenbang|pra[- ]?musrenbang|rkpdes/),budget=has(acts,/apbdes|dana desa|anggaran|monev dd|realisasi/),aid=has(acts,/sembako|pkh|blt/),idx=has(acts,/indeks desa|verval|pemutakhiran data|kuesioner/);
    const obj=[
      physical?'Melakukan monitoring perkembangan pembangunan fisik desa secara langsung. Kunjungan diarahkan untuk melihat kondisi dan perkembangan pekerjaan di lapangan serta memastikan kegiatan berjalan sesuai tahapan yang direncanakan.':'Melakukan monitoring terhadap kegiatan prioritas desa sesuai uraian kegiatan dalam DRP bulan berjalan.',
      'Memastikan pelaksanaan kegiatan sesuai dengan rencana kegiatan. Pendampingan dilakukan dengan mencermati kesesuaian antara kondisi lapangan, tahapan pekerjaan, kebutuhan sumber daya, dan rencana pelaksanaan.',
      'Mengidentifikasi kondisi, kendala, dan kebutuhan tindak lanjut dalam pelaksanaan kegiatan. Hasil pengamatan lapangan menjadi bahan koordinasi dan tindak lanjut bersama Pemerintah Desa.',
      'Mendukung terselenggaranya kegiatan pembangunan yang memberikan manfaat bagi masyarakat dan mendukung kebutuhan desa.',
      'Mendampingi Pemerintah Desa dalam mempersiapkan proses perencanaan pembangunan secara partisipatif, termasuk pencermatan usulan masyarakat dan kelengkapan administrasi musyawarah.',
      'Mendorong penetapan prioritas pembangunan berdasarkan kebutuhan dan kondisi masyarakat dengan mempertimbangkan urgensi, manfaat, dampak, kewenangan desa, dan kemampuan pembiayaan.',
      plan?'Mendukung penyusunan RKPDes dan DU-RKPDes Tahun Anggaran 2027 melalui pendampingan terhadap proses musyawarah, pembahasan usulan, dan penyelarasan prioritas pembangunan.':'Mendukung penyusunan perencanaan desa Tahun Anggaran 2027 berdasarkan hasil pembahasan dan kebutuhan masyarakat.',
      budget?'Mendampingi Pemerintah Desa dalam persiapan Perubahan APBDes Tahun Anggaran 2026 terutama terkait kesiapan dokumen serta penyelarasan program dan kegiatan.':'Mendampingi Pemerintah Desa dalam penataan dokumen perencanaan dan penganggaran desa sesuai ketentuan yang berlaku.',
      'Mendampingi penyusunan Rancangan APBDes sesuai ketentuan yang berlaku dengan memperhatikan prioritas penggunaan Dana Desa dan kebutuhan desa.',
      'Mendorong keterbukaan dan transparansi informasi desa melalui penyediaan informasi APBDes serta penguatan administrasi pendukung.',
      aid?'Melakukan pendampingan dalam pemutakhiran dan ketepatan data penerima bantuan masyarakat melalui sinkronisasi dan verifikasi data penerima.':'Mendukung ketepatan data dan pelaksanaan program pelayanan masyarakat sesuai kondisi yang tercatat dalam DRP.',
      'Mendukung penyediaan data dan kondisi awal sebagai bahan perencanaan pembangunan Tahun Anggaran 2027, termasuk melalui monitoring titik awal pekerjaan yang direncanakan.',
      'Mendorong percepatan penyelesaian proses monitoring dan evaluasi Dana Desa melalui koordinasi, penginputan data, dan penyelesaian kendala administrasi.',
      idx?'Memperkuat ketelitian dalam pendataan, verifikasi, dan pemutakhiran Data Indeks Desa agar data sesuai dengan kondisi aktual.':'Memperkuat ketelitian dalam pencatatan, verifikasi, dan pemutakhiran data kegiatan desa.'
    ];
    const sum=[
      'Pendataan dan pengelolaan data desa masih memerlukan penyempurnaan melalui verifikasi, validasi, perbaikan input, dan penyesuaian data berdasarkan kondisi aktual.',
      physical?'Pada pelaksanaan pembangunan fisik, monitoring dilakukan terhadap perkembangan pekerjaan, kondisi lapangan, kesesuaian tahapan, serta kebutuhan tindak lanjut.':'Pada pelaksanaan kegiatan desa, monitoring dilakukan untuk melihat perkembangan dan kebutuhan tindak lanjut berdasarkan kondisi lapangan.',
      plan?'Dalam proses perencanaan pembangunan, pendampingan diarahkan pada persiapan dan pelaksanaan musyawarah, pencermatan usulan, penetapan prioritas, serta penyusunan RKPDes dan DU-RKPDes Tahun 2027.':'Dalam proses perencanaan pembangunan, pendampingan diarahkan pada pencermatan kebutuhan dan penyiapan usulan prioritas desa.',
      budget?'Pada aspek penganggaran dan Dana Desa, dilakukan koordinasi, penataan dokumen, serta percepatan monitoring dan evaluasi agar pelaksanaan dan pelaporan berjalan tertib.':'Pada aspek administrasi dan penganggaran, dilakukan penataan dokumen sesuai kebutuhan dan ketentuan.',
      aid?'Pada program bantuan masyarakat, dilakukan pendampingan serta sinkronisasi dan verifikasi data penerima untuk mengurangi ketidaksesuaian data.':'Pada program pelayanan masyarakat, dilakukan pendampingan sesuai kondisi yang tercatat dalam DRP.',
      idx?'Kegiatan verifikasi dan pemutakhiran Data Indeks Desa menjadi bagian penting untuk memastikan data yang digunakan dalam perencanaan dan evaluasi lebih akurat.':'Kegiatan pencatatan dan pemutakhiran data menjadi bagian penting untuk mendukung perencanaan dan evaluasi.',
      'Secara umum, kegiatan kunjungan menghasilkan penguatan koordinasi antara Pendamping Lokal Desa, Pemerintah Desa, pelaksana kegiatan, operator, dan unsur terkait untuk memastikan setiap temuan dapat ditindaklanjuti.'
    ];
    return {intro:'Kunjungan lapangan bertujuan untuk melaksanakan pendampingan secara langsung kepada Pemerintah Desa dan masyarakat dalam memastikan proses pembangunan, perencanaan, pelaksanaan kegiatan, serta pengelolaan program desa berjalan sesuai dengan rencana dan ketentuan yang berlaku. Kunjungan dilakukan dengan melihat kondisi faktual di lapangan, melakukan koordinasi dengan pihak terkait, mencermati perkembangan kegiatan, serta memberikan pendampingan terhadap hal-hal yang memerlukan tindak lanjut.',obj:obj,sum:sum};
  }
  function follow(){return [
    'Meminta pihak yang bertanggung jawab menyelesaikan seluruh kekurangan, perbaikan, dan penyesuaian data sebelum dilakukan finalisasi.',
    'Melakukan review dan verifikasi ulang terhadap data, dokumen, dan informasi pendukung agar tidak terdapat kesalahan atau ketidaksesuaian.',
    'Mencocokkan data pada aplikasi dengan dokumen sumber dan dokumen administrasi desa sesuai kegiatan yang dilaporkan.',
    'Melakukan pengecekan ulang terhadap file atau dokumen sebelum proses upload maupun penyampaian laporan.',
    'Melakukan monitoring lanjutan terhadap progres fisik, volume, kualitas pekerjaan, dan kesesuaian kegiatan dengan perencanaan.',
    'Meminta Pemerintah Desa dan pelaksana kegiatan melengkapi dokumentasi pekerjaan, laporan realisasi, bukti pelaksanaan, serta dokumen administrasi pendukung.',
    'Mendorong pelaksana kegiatan mencatat setiap perkembangan mulai tahap persiapan, pelaksanaan sampai penyelesaian pekerjaan.',
    'Melakukan monitoring secara berkala terhadap kegiatan yang masih berjalan dan menyampaikan setiap temuan kepada Pemerintah Desa untuk ditindaklanjuti.',
    'Memastikan hasil pembangunan yang telah selesai tetap dipelihara dan dimanfaatkan masyarakat secara berkelanjutan.',
    'Setiap temuan atau ketidaksesuaian agar segera dikomunikasikan kepada pihak terkait dan dilakukan perbaikan berdasarkan kondisi riil serta dokumen yang sah.'
  ]}
  function recs(){return [
    'Pemerintah Desa perlu meningkatkan ketelitian dan pengendalian internal dalam proses pendataan, penginputan, pelaksanaan kegiatan, serta penyusunan laporan realisasi.',
    'Tim pelaksana dan operator perlu melakukan pengecekan berlapis sebelum data atau dokumen difinalisasi maupun diunggah.',
    'Setiap data dan informasi kegiatan harus didasarkan pada kondisi lapangan dan dokumen pendukung yang sah.',
    'Pelaksanaan kegiatan pembangunan harus berpedoman pada perencanaan, volume, spesifikasi, tahapan pekerjaan, dan anggaran yang telah ditetapkan.',
    'Pemerintah Desa perlu memastikan kelengkapan dokumentasi dan administrasi setiap kegiatan sebagai bagian dari pertanggungjawaban.',
    'Kegiatan pembangunan yang telah selesai agar dilakukan pemeliharaan secara berkala sehingga hasil pembangunan dapat dimanfaatkan secara berkelanjutan.',
    'Kegiatan yang masih dalam proses perlu dilakukan monitoring lanjutan secara berkala sampai pekerjaan selesai dan dokumen pertanggungjawaban lengkap.',
    'Koordinasi antara Pemerintah Desa, TPK, operator, Tim Pendata, dan Pendamping Lokal Desa perlu terus ditingkatkan agar setiap kendala dapat segera ditangani.'
  ]}

  async function saveMaster(input){
    const f=input&&input.files&&input.files[0];if(!f)return;
    if(!/\.docx$/i.test(f.name)){alert('Gunakan file master laporan .docx');return}
    await dbPut(new Blob([await f.arrayBuffer()],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),f.name);
    const st=document.getElementById('masterReportStatus');if(st)st.innerHTML='✅ Master tersimpan: <b>'+esc(f.name)+'</b>. KerjaDesa hanya mengisi data dan mempertahankan susunan Word asli.';
  }
  async function initStatus(){try{const x=await dbGet(),st=document.getElementById('masterReportStatus');if(st)st.innerHTML=x?'✅ Master tersimpan: <b>'+esc(x.name)+'</b>.':'Template master belum disimpan.'}catch(e){}}

  async function exportMaster(){
    const saved=await dbGet();if(!saved||!saved.blob)throw new Error('Master template laporan belum disimpan. Upload file DOCX master Anda satu kali terlebih dahulu.');
    const drp=data.docs&&data.docs.drp&&data.docs.drp.parsed;if(!drp||!drp.all||!drp.all.length)throw new Error('DRP belum diproses.');
    const zip=await JSZip.loadAsync(saved.blob);
    const doc=xmlDoc(await zip.file('word/document.xml').async('string'));
    const relDoc=xmlDoc(await zip.file('word/_rels/document.xml.rels').async('string'));
    const body=doc.getElementsByTagNameNS(W,'body')[0],ps=bodyParagraphs(body),tbls=bodyTables(body);
    if(tbls.length<12)throw new Error('Master DOCX tidak sesuai struktur laporan asli: diperlukan minimal 12 tabel.');
    const h=drp.header||{},periode=h.periode||periodLabel(),month=monthNameFromPeriod(periode),year=yearFromPeriod(periode);
    const acts=drp.all.slice().sort(function(a,b){return String(a.tanggal).localeCompare(String(b.tanggal))||Number(a.no||0)-Number(b.no||0)});
    const visit=[];const seen={};acts.forEach(function(a){const k=dk(a.tanggal);if(k&&!seen[k]){seen[k]=1;visit.push(a)}});
    const nama='SUDARMIN ARIPUDDIN',nik='760503312910050',kec='SENDANA',kab='MAJENE',prov='SULAWESI BARAT',pos='PLD',jab='Pendamping Lokal Desa';

    // Cover and headings: edit existing master paragraphs only.
    const replacePairs=[
      [/^LAPORAN KUNJUNGAN LAPANGAN SEPTEMBER$/i,'LAPORAN KUNJUNGAN LAPANGAN '+month.toUpperCase()],
      [/^SUDARMIN ARIPUDDIN$/i,nama],
      [/^PENDAMPING LOKAL DESA$/i,'PENDAMPING LOKAL DESA'],
      [/^KECAMATAN SENDANA$/i,'KECAMATAN '+kec],
      [/^KABUPATEN MAJENE$/i,'KABUPATEN '+kab],
      [/^PROVINSI SULAWSEI BARAT$/i,'PROVINSI '+prov],
      [/^TAHUN 2026$/i,'TAHUN '+year],
      [/^BULAN SEPTEMBER TAHUN 2026$/i,'BULAN '+month.toUpperCase()+' TAHUN '+year],
      [/^C\. Tujuan Kunjugan Lapangan$/i,'C. Tujuan Kunjungan Lapangan'],
      [/^D\. Hasil Kunjugan Lapangan$/i,'D. Hasil Kunjungan Lapangan'],
      [/^G\. Dokumentasi Kunjugan Lapangan$/i,'G. Dokumentasi Kunjungan Lapangan']
    ];
    replacePairs.forEach(function(pair){const p=ps.find(function(x){return pair[0].test(clean(textOf(x)))});if(p)setParagraphText(p,pair[1])});

    const ids=[['^NIK\\s*:', 'NIK: '+nik],['^Nama Lengkap\\s*:', 'Nama Lengkap: '+nama],['^Kecamatan\\s*:', 'Kecamatan: '+titleCase(kec)],['^Kabupaten\\s*:', 'Kabupaten: '+titleCase(kab)],['^Provinsi\\s*:', 'Provinsi: '+titleCase(prov)],['^Posisi\\s*:', 'Posisi: '+pos],['^Jabatan\\s*:', 'Jabatan: '+jab]];
    ids.forEach(function(pair){const p=ps.find(function(x){return new RegExp(pair[0],'i').test(clean(textOf(x)))});if(p)setParagraphText(p,pair[1])});

    // B table: keep every master row and all widths/merges.
    const bt=tbls[0],br=rows(bt);
    for(let i=0;i<20;i++){
      const rr=br[3+i],cs=rr?cells(rr):[],a=visit[i];
      if(!rr||cs.length<4)continue;
      if(a){setCellText(cs[0],'Hari ke-'+(i+1));setCellText(cs[1],dateLong(a.tanggal));setCellText(cs[2],kec);setCellText(cs[3],village(a.lokasi))}
      else cs.forEach(function(c){setCellText(c,'')});
    }
    if(br[br.length-1])setCellText(cells(br[br.length-1])[0],'Total Hari Kunjungan Lapangan Bulan '+month+' Tahun '+year+' : '+visit.length+' Hari');

    const nar=narratives(acts),Cidx=ps.findIndex(function(p){return /^C\. Tujuan Kunjungan Lapangan$/i.test(clean(textOf(p)))}),Didx=ps.findIndex(function(p){return /^D\. Hasil Kunjungan Lapangan$/i.test(clean(textOf(p)))});
    const Cparas=ps.slice(Cidx+1,Didx>Cidx?Didx:ps.length).filter(function(p){const t=clean(textOf(p));return t&&!/^\\s*D\\./i.test(t)});
    if(Cparas.length){setParagraphText(Cparas[0],nar.intro);nar.obj.forEach(function(v,i){if(Cparas[i+1])setParagraphText(Cparas[i+1],v)});nar.sum.forEach(function(v,i){if(Cparas[i+14])setParagraphText(Cparas[i+14],v)})}

    // D table: ALL DRP records, in chronological order.
    const dt=tbls[1],dRows=rows(dt);
    acts.slice(0,22).forEach(function(a,i){const rr=dRows[i+1];if(!rr)return;const cs=cells(rr);if(cs.length>=4){setCellText(cs[0],String(i+1));setCellText(cs[1],dateLong(a.tanggal));setCellText(cs[2],village(a.lokasi));setCellText(cs[3],clean(a.deskripsi))}});
    for(let i=acts.length+1;i<dRows.length;i++)cells(dRows[i]).forEach(function(c){setCellText(c,'')});

    // D summary block.
    let dStart=ps.findIndex(function(p){return /^Hasil kunjungan lapangan menunjukkan beberapa capaian/i.test(clean(textOf(p)))});if(dStart>=0){let n=0;for(let i=dStart+1;i<ps.length&&n<7;i++){const t=clean(textOf(ps[i]));if(/^E\./i.test(t))break;if(t){setParagraphText(ps[i],nar.sum[n]||'');n++}}}

    // E and F: preserve master's paragraph slots.
    const Eidx=ps.findIndex(function(p){return /^E\. Langkah Tindak Lanjut Penanganan Lapangan$/i.test(clean(textOf(p)))}),Fidx=ps.findIndex(function(p){return /^F\. Rekomendasi$/i.test(clean(textOf(p)))}),Gidx=ps.findIndex(function(p){return /^G\. Dokumentasi Kunjungan Lapangan$/i.test(clean(textOf(p)))});
    const ef=follow(),fr=recs();
    if(Eidx>=0){let n=0;for(let i=Eidx+1;i<(Fidx>Eidx?Fidx:ps.length)&&n<11;i++){if(clean(textOf(ps[i]))){setParagraphText(ps[i],n===0?'Berdasarkan hasil kunjungan lapangan selama Bulan '+month+' '+year+', tindak lanjut yang dilakukan difokuskan pada penyelesaian temuan, penyempurnaan data, pemantauan kegiatan pembangunan, penguatan administrasi, serta koordinasi dengan unsur terkait.':(ef[n-1]||''));n++}}}
    if(Fidx>=0){let n=0;for(let i=Fidx+1;i<(Gidx>Fidx?Gidx:ps.length)&&n<10;i++){if(clean(textOf(ps[i]))){setParagraphText(ps[i],n===0?'Berdasarkan hasil kunjungan lapangan yang telah dilaksanakan selama Bulan '+month+' '+year+' di wilayah Kecamatan '+titleCase(kec)+', Kabupaten '+titleCase(kab)+', terdapat beberapa rekomendasi yang perlu menjadi perhatian Pemerintah Desa sebagai bahan perbaikan dan tindak lanjut pada periode berikutnya.':(fr[n-1]||''));n++}}}
    const dateP=ps.find(function(p){return /^Sendana\s+/i.test(clean(textOf(p)))});if(dateP)setParagraphText(dateP,'Sendana 30 '+month+' '+year);

    // G: exact original table layout, replacing only top text and existing picture binaries.
    const rels=Array.from(relDoc.getElementsByTagNameNS(R,'Relationship')),relMap={};rels.forEach(function(x){relMap[x.getAttribute('Id')]=x.getAttribute('Target')});
    const photos=(window.activityPhotos||[]).filter(function(p){return p&&p.url&&p.date}).slice().sort(function(a,b){return dk(a.date).localeCompare(dk(b.date))});
    const slots=[];photos.forEach(function(p){const a=acts.find(function(x){return dk(x.tanggal)===dk(p.date)});if(a)slots.push({p:p,a:a})});
    const gTables=tbls.slice(2,12);
    for(let ti=0;ti<gTables.length;ti++){
      const rr=rows(gTables[ti]);if(rr.length<2)continue;
      const top=cells(rr[0]),bot=cells(rr[1]);
      for(let c=0;c<2;c++){
        const item=slots[ti*2+c];
        if(!item){setCellText(top[c],'');clearCellDrawings(bot[c]);continue}
        setCellText(top[c],'Lokasi: '+village(item.a.lokasi)+'\\nTanggal '+item.p.date+'\\nKegiatan ; '+docTitle(item.a.deskripsi));
        const blips=Array.from(bot[c].getElementsByTagNameNS(A,'blip'));
        if(blips.length){const rid=blips[0].getAttributeNS(R,'embed'),target=relMap[rid];if(target){const m=String(item.p.url).match(/^data:image\/([^;]+);base64,(.+)$/);if(m)zip.file('word/'+target.replace(/^\\.\\.\\//,''),m[2],{base64:true})}}
      }
    }
    zip.file('word/document.xml',xmlStr(doc));
    return zip;
  }

  window.kdLoadMasterReportTemplate=saveMaster;
  window.kdInitMasterReportStatus=initStatus;
  window.kdHasMasterTemplate=async function(){return !!(await dbGet())};
  window.kdExportMasterReport=exportMaster;
  window.downloadWord=async function(){
    try{
      const zip=await exportMaster(),blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
      const p=data.docs&&data.docs.drp&&data.docs.drp.parsed&&data.docs.drp.parsed.header?data.docs.drp.parsed.header.periode:periodLabel();
      const m=monthNameFromPeriod(p),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Laporan_Kunjungan_Lapangan_'+m+'_2026.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},3000);
    }catch(e){console.error(e);alert('Gagal membuat laporan dari master: '+(e&&e.message||e))}
  };
  setTimeout(initStatus,600);
})();