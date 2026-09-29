/* KerjaDesa master-template engine: preserves the user's original DOCX structure. */
(function(){
  const DB='KerjaDesaMasterTemplateDB', STORE='files';
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const A='http://schemas.openxmlformats.org/drawingml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  function dbOpen(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function dbPut(blob){
    const db=await dbOpen(); return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({blob:blob,name:blob.name||'master.docx',savedAt:Date.now()},'report');
      tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)};
    });
  }
  async function dbGet(){
    const db=await dbOpen(); return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get('report');
      req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)};
    });
  }
  function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
  function xmlDoc(str){return new DOMParser().parseFromString(str,'application/xml')}
  function xmlStr(doc){return new XMLSerializer().serializeToString(doc)}
  function directChildren(el,local){return [...el.children].filter(x=>x.localName===local)}
  function textOf(el){return [...el.getElementsByTagNameNS(W,'t')].map(x=>x.textContent||'').join('')}
  function setParagraphText(p,text){
    const pPr=p.getElementsByTagNameNS(W,'pPr')[0], firstRun=p.getElementsByTagNameNS(W,'r')[0], rPr=firstRun?.getElementsByTagNameNS(W,'rPr')[0]?.cloneNode(true);
    [...p.childNodes].forEach(n=>{if(n.nodeType===1 && n.localName!=='pPr')p.removeChild(n)});
    const lines=String(text??'').split('\n');
    lines.forEach((line,i)=>{
      if(i){const br=p.ownerDocument.createElementNS(W,'w:br');p.appendChild(p.ownerDocument.createElementNS(W,'w:r')).appendChild(br)}
      const r=p.ownerDocument.createElementNS(W,'w:r');
      if(rPr)r.appendChild(rPr.cloneNode(true));
      const t=p.ownerDocument.createElementNS(W,'w:t');t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');t.textContent=line;r.appendChild(t);p.appendChild(r);
    });
  }
  function setCellText(tc,text){
    const p=tc.getElementsByTagNameNS(W,'p')[0] || tc.appendChild(tc.ownerDocument.createElementNS(W,'w:p'));
    setParagraphText(p,text);
    [...tc.children].filter(x=>x.localName==='p' && x!==p).forEach(x=>tc.removeChild(x));
  }
  function rowCells(tr){return directChildren(tr,'tc')}
  function tableRows(tbl){return directChildren(tbl,'tr')}
  function dateLong(d){
    const m=String(d||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m)return String(d||'');
    return String(m[1]).padStart(2,'0')+' '+(window.MONTH_NAMES?.[Number(m[2])-1]||['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][Number(m[2])-1]||'')+' '+m[3];
  }
  function titleCase(s){return String(s||'').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase())}
  function locVillage(loc){
    const parts=String(loc||'').split('/');
    const last=parts[parts.length-1]?.trim()||'';
    return titleCase(last||loc||'-');
  }
  function uniqDates(acts){
    const seen=new Set(),out=[]; (acts||[]).slice().sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||Number(a.no)-Number(b.no)).forEach(a=>{const k=window.dateKey?dateKey(a.tanggal):a.tanggal;if(!seen.has(k)){seen.add(k);out.push(a)}});
    return out;
  }
  function activities(){
    const drp=data.docs?.drp?.parsed; if(!drp)return [];
    return (drp.all||[]).slice().sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||Number(a.no||0)-Number(b.no||0));
  }
  function has(acts,rx){return acts.some(a=>rx.test(String(a.deskripsi||'').toLowerCase()))}
  function masterNarratives(acts){
    const physical=has(acts,/pembangunan|jalan|rabat|jembatan|drainase|koperasi|kanopi/);
    const indeks=has(acts,/indeks desa|verval|pemutakhiran data|kuesioner/);
    const plan=has(acts,/musrenbang|pra[- ]?musrenbang|rkpdes/);
    const budget=has(acts,/apbdes|dana desa|anggaran|monev dd|realisasi/);
    const aid=has(acts,/sembako|pkh|blt/);
    const o=[
      'Melakukan monitoring perkembangan pembangunan fisik desa secara langsung. Kunjungan diarahkan untuk melihat kondisi dan perkembangan pekerjaan di lapangan serta memastikan kegiatan berjalan sesuai tahapan yang direncanakan.',
      'Memastikan pelaksanaan kegiatan sesuai dengan rencana kegiatan. Pendampingan dilakukan dengan mencermati kesesuaian antara kondisi lapangan, tahapan pekerjaan, kebutuhan sumber daya, dan rencana pelaksanaan.',
      'Mengidentifikasi kondisi, kendala, dan kebutuhan tindak lanjut dalam pelaksanaan kegiatan. Hasil pengamatan lapangan menjadi bahan koordinasi dan penyelesaian bersama Pemerintah Desa.',
      'Mendukung terselenggaranya kegiatan desa yang memberikan manfaat bagi masyarakat. Monitoring dan pendampingan diarahkan agar hasil kegiatan mendukung kebutuhan serta kepentingan masyarakat.',
      'Mendampingi Pemerintah Desa dalam mempersiapkan proses perencanaan pembangunan secara partisipatif, termasuk pencermatan usulan masyarakat dan kelengkapan administrasi musyawarah.',
      'Mendorong penetapan prioritas pembangunan berdasarkan kebutuhan dan kondisi masyarakat dengan mempertimbangkan urgensi, manfaat, kewenangan desa, dan kemampuan pembiayaan.',
      'Mendukung penyusunan RKPDes dan DU-RKPDes Tahun Anggaran 2027 melalui pendampingan terhadap proses musyawarah, pembahasan usulan, dan penyelarasan prioritas pembangunan.',
      'Mendampingi Pemerintah Desa dalam persiapan Perubahan APBDes Tahun Anggaran 2026, terutama terkait kesiapan dokumen dan penyelarasan program dengan kebutuhan serta prioritas desa.',
      'Mendampingi penyusunan Rancangan APBDes sesuai ketentuan yang berlaku dengan memperhatikan perencanaan kegiatan dan prioritas penggunaan Dana Desa.',
      'Mendorong keterbukaan dan transparansi informasi desa melalui penyediaan dan pemasangan informasi APBDes serta penguatan administrasi pendukung.',
      'Melakukan pendampingan dalam pemutakhiran dan ketepatan data penerima bantuan masyarakat melalui sinkronisasi dan verifikasi data penerima.',
      'Mendukung penyediaan data dan kondisi awal sebagai bahan perencanaan pembangunan Tahun Anggaran 2027, termasuk melalui monitoring titik awal pekerjaan yang direncanakan.',
      'Mendorong percepatan penyelesaian proses monitoring dan evaluasi Dana Desa melalui koordinasi, penginputan data, dan penyelesaian kendala administrasi.',
      'Memperkuat koordinasi antara Pendamping Lokal Desa, Pemerintah Desa, pelaksana kegiatan, dan unsur terkait dalam seluruh tahapan pendampingan.'
    ];
    if(!physical)o[0]='Melakukan monitoring terhadap kegiatan prioritas desa sesuai uraian kegiatan dalam DRP bulan berjalan.';
    if(!indeks)o[6]='Mendukung penyusunan perencanaan desa Tahun Anggaran 2027 berdasarkan hasil pembahasan dan kebutuhan masyarakat.';
    if(!plan)o[4]='Mendampingi Pemerintah Desa dalam proses perencanaan dan penguatan usulan kegiatan sesuai kebutuhan masyarakat.';
    if(!budget)o[8]='Mendampingi penyusunan dan penataan dokumen perencanaan serta penganggaran desa sesuai ketentuan yang berlaku.';
    if(!aid)o[10]='Mendukung ketepatan data dan pelaksanaan program pelayanan masyarakat sesuai kondisi yang ditemukan dalam DRP.';
    const cons=[
      'Secara khusus, kunjungan lapangan diarahkan untuk memperoleh informasi faktual, memantau perkembangan kegiatan, dan mengidentifikasi kebutuhan tindak lanjut berdasarkan kondisi yang ditemukan di lapangan.',
      'Selain monitoring kegiatan, pendampingan dilakukan melalui koordinasi dengan Pemerintah Desa dan unsur terkait agar setiap tahapan perencanaan, pelaksanaan, administrasi, dan pelaporan dapat berjalan tertib.',
      'Hasil kunjungan menjadi bahan pencermatan dan penguatan dalam penyusunan rencana pembangunan, penganggaran, pendataan, serta penyelesaian kegiatan yang masih memerlukan tindak lanjut.',
      'Dengan demikian, keseluruhan kunjungan lapangan diarahkan untuk memperkuat pendampingan, meningkatkan ketepatan pelaksanaan kegiatan, dan mendukung pembangunan desa sesuai kebutuhan serta prioritas masyarakat.'
    ];
    return {intro:'Kunjungan lapangan bertujuan untuk melaksanakan pendampingan secara langsung kepada Pemerintah Desa dan masyarakat dalam memastikan proses pembangunan, perencanaan, pelaksanaan kegiatan, serta pengelolaan program desa berjalan sesuai dengan rencana dan ketentuan yang berlaku. Kunjungan dilakukan dengan melihat kondisi faktual di lapangan, melakukan koordinasi dengan pihak terkait, mencermati perkembangan kegiatan, serta memberikan pendampingan terhadap hal-hal yang memerlukan tindak lanjut.',obj:o,cons};
  }
  function masterFollow(){
    return [
      'Meminta pihak yang bertanggung jawab menyelesaikan seluruh kekurangan, perbaikan, dan penyesuaian data sebelum dilakukan finalisasi.',
      'Melakukan review dan verifikasi ulang terhadap data, dokumen, dan informasi pendukung agar tidak terdapat kesalahan atau ketidaksesuaian.',
      'Mencocokkan data pada aplikasi dengan dokumen sumber dan dokumen administrasi desa sesuai kegiatan yang dilaporkan.',
      'Melakukan pengecekan ulang terhadap file atau dokumen sebelum proses upload maupun penyampaian laporan.',
      'Untuk kegiatan pembangunan, melakukan monitoring lanjutan terhadap progres fisik, volume, kualitas pekerjaan, dan kesesuaian dengan perencanaan.',
      'Meminta Pemerintah Desa dan pelaksana kegiatan melengkapi dokumentasi pekerjaan, laporan realisasi, bukti pelaksanaan, serta dokumen administrasi pendukung.',
      'Mendorong pelaksana kegiatan mencatat setiap perkembangan mulai tahap persiapan, pelaksanaan sampai penyelesaian pekerjaan.',
      'Melakukan monitoring secara berkala terhadap kegiatan yang masih berjalan dan menyampaikan setiap temuan kepada Pemerintah Desa untuk ditindaklanjuti.',
      'Memastikan hasil kegiatan yang telah selesai tetap dipelihara dan dimanfaatkan secara berkelanjutan.',
      'Setiap temuan atau ketidaksesuaian agar segera dikomunikasikan kepada pihak terkait dan dilakukan perbaikan berdasarkan kondisi riil serta dokumen yang sah.'
    ];
  }
  function masterRecs(){
    return [
      'Pemerintah Desa perlu meningkatkan ketelitian dan pengendalian internal dalam proses pendataan, penginputan, pelaksanaan kegiatan, serta penyusunan laporan realisasi.',
      'Tim pelaksana dan operator perlu melakukan pengecekan berlapis sebelum data atau dokumen difinalisasi maupun diunggah.',
      'Setiap data dan informasi kegiatan harus didasarkan pada kondisi lapangan dan dokumen pendukung yang sah.',
      'Pelaksanaan kegiatan pembangunan harus berpedoman pada perencanaan, volume, spesifikasi, tahapan pekerjaan, dan anggaran yang telah ditetapkan.',
      'Pemerintah Desa perlu memastikan kelengkapan dokumentasi dan administrasi setiap kegiatan sebagai bagian dari pertanggungjawaban.',
      'Kegiatan yang telah selesai agar dipelihara secara berkala sehingga hasil pembangunan memberikan manfaat jangka panjang.',
      'Kegiatan yang masih dalam proses perlu dimonitor secara berkala sampai pekerjaan selesai dan dokumen pertanggungjawaban lengkap.',
      'Koordinasi antara Pemerintah Desa, pelaksana kegiatan, operator, tim pendata, dan Pendamping Lokal Desa perlu terus ditingkatkan agar kendala dapat segera ditangani.'
    ];
  }
  function setMainParaByPrefix(paras,prefix,text){const p=paras.find(p=>textOf(p).trim().toLowerCase().startsWith(prefix.toLowerCase()));if(p)setParagraphText(p,text)}
  function allMainParas(body){return [...body.children].filter(n=>n.localName==='p')}
  async function loadMasterReportTemplate(input){
    const f=input?.files?.[0]; if(!f)return;
    if(!/\\.docx$/i.test(f.name)){alert('Gunakan file master laporan .docx');return}
    await dbPut(new Blob([await f.arrayBuffer()],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
    const st=document.getElementById('masterReportStatus');if(st)st.innerHTML='✅ Master tersimpan: <b>'+esc(f.name)+'</b>. Format Word asli akan dipertahankan saat membuat laporan.';
  }
  async function hasMaster(){try{return !!(await dbGet())}catch(e){return false}}
  async function initStatus(){
    try{const x=await dbGet();const st=document.getElementById('masterReportStatus');if(st)st.innerHTML=x?'✅ Master tersimpan: <b>'+esc(x.name)+'</b>.':'Template master belum disimpan.'}catch(e){}
  }
  async function buildFromMaster(){
    const saved=await dbGet(); if(!saved?.blob)throw new Error('Master template belum disimpan. Upload file DOCX laporan asli sekali pada bagian Master Template.');
    const drp=data.docs?.drp?.parsed; if(!drp?.all?.length)throw new Error('DRP belum diproses.');
    const zip=await JSZip.loadAsync(saved.blob), xml=await zip.file('word/document.xml').async('string');
    const rel=await zip.file('word/_rels/document.xml.rels').async('string');
    const doc=xmlDoc(xml),body=doc.getElementsByTagNameNS(W,'body')[0],tables=[...body.getElementsByTagNameNS(W,'tbl')],paras=allMainParas(body);
    if(tables.length<12)throw new Error('Master template tidak sesuai struktur laporan asli (12 tabel diharapkan).');
    const h=drp.header||{}, acts=(drp.all||[]).slice().sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||Number(a.no||0)-Number(b.no||0));
    const month=window.monthNameFromPeriod?monthNameFromPeriod(h.periode||periodLabel()):'September', year=window.yearFromPeriod?yearFromPeriod(h.periode||periodLabel()):'2026';
    const nama='SUDARMIN ARIPUDDIN',pos='PENDAMPING LOKAL DESA',kec='SENDANA',kab='MAJENE',prov='SULAWESI BARAT',nik='760503312910050';
    setMainParaByPrefix(paras,'KEMENTERIAN DESA DAN PEMBANGUNAN DAERAH TERTINGGAL REPUBLIK INDONESIA','KEMENTERIAN DESA DAN PEMBANGUNAN DAERAH TERTINGGAL REPUBLIK INDONESIA');
    setMainParaByPrefix(paras,'LAPORAN KUNJUNG GAN LAPANGAN','LAPORAN KUNJUNGAN LAPANGAN '+month.toUpperCase());
    setMainParaByPrefix(paras,'LAPORAN KUNJUNGAN LAPANGAN SEPTEMBER','LAPORAN KUNJUNGAN LAPANGAN '+month.toUpperCase());
    setMainParaByPrefix(paras,'SUDARMIN ARIPUDDIN',nama);
    setMainParaByPrefix(paras,'PENDAMPING LOKAL DESA',pos);
    setMainParaByPrefix(paras,'KECAMATAN SENDANA','KECAMATAN '+kec);
    setMainParaByPrefix(paras,'KABUPATEN MAJENE','KABUPATEN '+kab);
    setMainParaByPrefix(paras,'PROVINSI SULAWSEI BARAT','PROVINSI '+prov);
    setMainParaByPrefix(paras,'TAHUN 2026','TAHUN '+year);
    setMainParaByPrefix(paras,'BULAN SEPTEMBER TAHUN 202 6','BULAN '+month.toUpperCase()+' TAHUN '+year);
    const idPrefixes=['NIK :','Nama Lengkap :','Kecamatan :','Kabupaten :','Provinsi :','Posisi :','Jabatan :'];
    const vals=['NIK : '+nik,'Nama Lengkap : '+nama,'Kecamatan : '+titleCase(kec),'Kabupaten : '+titleCase(kab),'Provinsi : '+titleCase(prov),'Posisi : PLD','Jabatan : Pendamping Lokal Desa'];
    idPrefixes.forEach((p,i)=>{const el=paras.find(x=>textOf(x).trim().startsWith(p));if(el)setParagraphText(el,vals[i])});
    const bTitle=paras.find(p=>/Waktu Pelaksanaan Kunjungan Lapangan/i.test(textOf(p))); if(bTitle)setParagraphText(bTitle,'Waktu Pelaksanaan Kunjungan Lapangan');
    const b= tables[0], br=tableRows(b), slots=[3,...Array.from({length:19},(_,i)=>5+i)]; 
    const visit=uniqDates(drp.kunlap?.length?drp.kunlap:acts).slice(0,20);
    slots.forEach((ri,idx)=>{const r=br[ri];if(!r)return;const cs=rowCells(r);if(idx<visit.length){setCellText(cs[0],'Harike'+(idx+1));setCellText(cs[1],dateLong(visit[idx].tanggal));setCellText(cs[2],titleCase(kec));setCellText(cs[3],locVillage(visit[idx].lokasi));}else cs.forEach(c=>setCellText(c,''));});
    const tot=br[br.length-1]; if(tot)setCellText(rowCells(tot)[0],'Total Hari Kunjungan Lapangan Bulan '+month+' Tahun '+year+' : '+visit.length+' Hari');
    const dTable=tables[1], dr=tableRows(dTable);
    acts.slice(0,22).forEach((a,i)=>{const r=dr[i+1];if(!r)return;const cs=rowCells(r);setCellText(cs[0],String(i+1));setCellText(cs[1],dateLong(a.tanggal));setCellText(cs[2],locVillage(a.lokasi));setCellText(cs[3],String(a.deskripsi||'').replace(/\\s+/g,' ').trim())});
    for(let i=acts.length+1;i<dr.length;i++)rowCells(dr[i]).forEach(c=>setCellText(c,''));
    const nar=masterNarratives(acts), e=masterFollow(), f=masterRecs();
    const idxC=paras.findIndex(p=>/^C\\s*\\./i.test(textOf(p).trim()));
    const idxD=paras.findIndex(p=>/^D\\s*\\./i.test(textOf(p).trim()));
    const cParas=idxC>=0?paras.slice(idxC+1,idxD>idxC?idxD:paras.length):[];
    if(cParas.length){setParagraphText(cParas[0],nar.intro);for(let i=0;i<14;i++)if(cParas[i+1])setParagraphText(cParas[i+1],nar.obj[i]||'');for(let i=0;i<4;i++)if(cParas[i+15])setParagraphText(cParas[i+15],nar.cons[i]||'')}
    const idxE=paras.findIndex(p=>/^E\\s*\\./i.test(textOf(p).trim())),idxF=paras.findIndex(p=>/^F\\s*\\./i.test(textOf(p).trim())),idxG=paras.findIndex(p=>/^G\\s*\\./i.test(textOf(p).trim()));
    const eParas=idxE>=0?paras.slice(idxE+1,idxF>idxE?idxF:paras.length):[];
    if(eParas.length){setParagraphText(eParas[0],'Berdasarkan hasil kunjungan lapangan selama Bulan '+month+' '+year+', tindak lanjut yang dilakukan difokuskan pada penyelesaian temuan, penyempurnaan data, pemantauan kegiatan pembangunan, penguatan administrasi, serta koordinasi dengan unsur terkait.');for(let i=0;i<10;i++)if(eParas[i+1])setParagraphText(eParas[i+1],e[i]);}
    const fParas=idxF>=0?paras.slice(idxF+1,idxG>idxF?idxG:paras.length):[];
    if(fParas.length){setParagraphText(fParas[0],'Berdasarkan hasil kunjungan lapangan yang telah dilaksanakan selama Bulan '+month+' '+year+' di wilayah Kecamatan '+titleCase(kec)+', Kabupaten '+titleCase(kab)+', terdapat beberapa rekomendasi yang perlu menjadi perhatian Pemerintah Desa sebagai bahan perbaikan dan tindak lanjut pada periode berikutnya.');for(let i=0;i<8;i++)if(fParas[i+1])setParagraphText(fParas[i+1],f[i]);if(fParas[9])setParagraphText(fParas[9],'Kesimpulan: Secara keseluruhan, kunjungan lapangan pada '+month+' '+year+' difokuskan pada pendampingan, monitoring, verifikasi, koordinasi, dan penguatan tata kelola kegiatan desa sesuai kondisi yang ditemukan dalam DRP.');}
    if(idxF>0){const dt=paras.find(p=>/^Sendana\\s+3\\s*1/i.test(textOf(p).trim())||/^Sendana/i.test(textOf(p).trim()));if(dt)setParagraphText(dt,'Sendana '+String(30)+' '+month.toLowerCase()+' '+year)}
    /* G: 10 two-column tables, one photo per cell, using original table borders/widths. */
    const relDoc=xmlDoc(rel), relNodes=[...relDoc.getElementsByTagNameNS(R,'Relationship')], relMap=new Map(relNodes.map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
    const docTables=tables.slice(2,12), pics=(window.activityPhotos||[]).filter(p=>p?.url&&p?.date).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const matched=pics.slice(0,20);
    for(let i=0;i<docTables.length;i++){
      const tbl=docTables[i], rows=tableRows(tbl); const top=rows[0], bottom=rows[1], tcTop=rowCells(top),tcBot=rowCells(bottom);
      for(let c=0;c<2;c++){
        const item=matched[i*2+c]; if(item){
          const act=acts.find(a=>(window.dateKey?dateKey(a.tanggal):a.tanggal)===(window.dateKey?dateKey(item.date):item.date))||{};
          setCellText(tcTop[c],'Lokasi: '+locVillage(act.lokasi||'')+'\\nTanggal '+String(item.date||act.tanggal||'')+'\\nKegiatan ; '+(window.docActivityTitle?docActivityTitle(act.deskripsi||''):String(act.deskripsi||'').slice(0,120)));
        }else setCellText(tcTop[c],'');
        const blips=tcBot[c].getElementsByTagNameNS(A,'blip');if(blips.length){const rid=blips[0].getAttributeNS(R,'embed');const target=relMap.get(rid);if(target){
          let dataUrl=null;
          if(item)dataUrl=item.url;
          const m=String(dataUrl||'').match(/^data:image\/([^;]+);base64,(.+)$/);
          if(m){
            const ext=(target.split('.').pop()||'jpeg').toLowerCase(),type=ext==='png'?'image/png':'image/jpeg';
            const useUrl=await new Promise(resolve=>{
              const im=new Image();im.onload=()=>{
                const cv=document.createElement('canvas');cv.width=im.naturalWidth||1;cv.height=im.naturalHeight||1;
                const cx=cv.getContext('2d');cx.drawImage(im,0,0);resolve(cv.toDataURL(type,0.9));
              };im.onerror=()=>resolve(dataUrl);im.src=dataUrl;
            });
            const b64=useUrl.split(',')[1];zip.file('word/'+target,b64,{base64:true});
          }else{
            const ext=(target.split('.').pop()||'jpeg').toLowerCase();
            const blank=await new Promise(res=>{const cv=document.createElement('canvas');cv.width=2;cv.height=2;cv.toBlob(b=>b.arrayBuffer().then(res),ext==='png'?'image/png':'image/jpeg',0.8)});
            zip.file('word/'+target,blank);
          }
        }}
      }
    }
    zip.file('word/document.xml',xmlStr(doc));
    return zip;
  }
  window.kdLoadMasterReportTemplate=loadMasterReportTemplate;
  window.kdInitMasterReportStatus=initStatus;
  window.kdHasMasterTemplate=hasMaster;
  window.kdExportMasterReport=buildFromMaster;
  setTimeout(initStatus,500);
})();