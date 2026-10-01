(function(){
  const s=document.createElement('style');
  s.id='kd-report-master-v2-css';
  s.textContent=`
@page{size:A4 portrait;margin:0}
@page landscape{size:A4 landscape;margin:0}
.print-report{font-family:"Times New Roman",serif;color:#111;background:#fff}
.print-report .report-page{box-sizing:border-box;width:210mm;min-height:297mm;padding:12mm 15mm;margin:0;background:#fff;page:portrait;break-after:page;page-break-after:always;overflow:visible}
.print-report .report-page.landscape-page{width:297mm;min-height:210mm;padding:12mm 15mm;page:landscape}
.print-report .report-page:last-child{break-after:auto;page-break-after:auto}
.print-report .master-cover{padding:0!important;position:relative}
.print-report .master-cover .cover-head{position:relative;min-height:210mm;width:100%;text-align:center;font-weight:700}
.print-report .master-cover .cover-instansi{font-size:7pt;line-height:1.25;padding-top:3mm}
.print-report .master-cover .cover-logo{display:block;width:73mm;height:73mm;object-fit:contain;margin:13mm auto 12mm}
.print-report .master-cover .cover-title{font-size:8pt;margin:0 0 3mm}
.print-report .master-cover .cover-name,.print-report .master-cover .cover-position,.print-report .master-cover .cover-region,.print-report .master-cover .cover-footer-title{font-size:7.5pt;line-height:1.35}
.print-report .master-cover .cover-region{margin-top:6mm}
.print-report .master-cover .cover-footer-title{margin-top:8mm}
.print-report .report-page h3{font-size:13pt;margin:4mm 0 2.5mm}
.print-report .report-page p,.print-report .report-page li{font-size:11pt;line-height:1.45;text-align:justify}
.print-report .identity-table{width:75%;border-collapse:collapse;margin-bottom:5mm}
.print-report .identity-table td{border:0;padding:2px 5px;font-size:11pt}
.print-report .identity-table td:first-child{width:42mm}
.print-report .wide-table,.print-report .result-table{width:100%;border-collapse:collapse;font-size:9.5pt}
.print-report .wide-table th,.print-report .wide-table td,.print-report .result-table th,.print-report .result-table td{border:1px solid #555;padding:4px;vertical-align:top}
.print-report .wide-table th,.print-report .result-table th{text-align:center}
.print-report .result-table tr{break-inside:auto;page-break-inside:auto}
.print-report .result-table td:last-child{white-space:normal;overflow-wrap:anywhere;word-break:normal}
.print-report .master-doc-table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:4mm;font-size:9pt}
.print-report .master-doc-cell{width:50%;vertical-align:top;border:1px solid #333;padding:0;break-inside:avoid;page-break-inside:avoid}
.print-report .master-doc-cell.empty{border:0}
.print-report .master-doc-info{padding:3mm;line-height:1.35;min-height:22mm}
.print-report .master-doc-info div{margin-bottom:2mm}
.print-report .master-doc-photos{border-top:1px solid #333;padding:3mm;display:flex;flex-direction:column;align-items:center;gap:3mm;min-height:45mm}
.print-report .master-doc-photo{width:100%;display:flex;justify-content:center;align-items:center;overflow:hidden}
.print-report .master-doc-photo img{display:block;width:auto;max-width:78mm;height:auto;max-height:62mm;object-fit:contain}
.print-report .master-doc-empty{width:100%;min-height:30mm;display:flex;align-items:center;justify-content:center;color:#666;font-style:italic;text-align:center}
.print-report .signature{text-align:center;margin-top:12mm;font-size:11pt}
.print-report .master-note{font-size:9pt!important;text-align:left!important;margin-bottom:3mm}
@media screen{
  .print-report{background:#e9edf0;padding:10mm}
  .print-report .report-page{margin:0 auto 10mm;box-shadow:0 2px 12px rgba(0,0,0,.12)}
}
@media print{
  body{background:#fff!important;padding:0!important}
  header,.nav,#login,#app>div:not(#dokumen),#dokumen>.card:not(.print-area),#docResult,.no-print{display:none!important}
  #dokumen{display:block!important}
  .report-print,.print-report{display:block!important}
  .print-report .report-page{margin:0!important;box-shadow:none!important}
  .print-report .landscape-page{page:landscape}
  .print-report .portrait-page{page:portrait}
}
`;
  document.head.appendChild(s);
})();
/* KerjaDesa report master v2
   Purpose: reproduce the user's original Word master structure:
   A4 paper, mixed portrait/landscape sections, DRP-first content.
*/
(function(){
  const esc2 = window.kdReportEsc || function(v){
    return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  };
  const safeArr = v => Array.isArray(v) ? v : [];
  const dLong = window.dateLongId || function(v){return String(v||'')};
  const monthUpper = v => String(v||'').toUpperCase();

  function reportPageClass(kind){
    return kind === 'landscape' ? 'report-page landscape-page' : 'report-page portrait-page';
  }

  function buildAllActivityRecap(allActs, month, year){
    return '<section class="'+reportPageClass('landscape')+'"><h3>H. Rekapitulasi Seluruh Aktivitas DRP</h3>'+
      '<p>Rekapitulasi ini memuat seluruh aktivitas yang tercatat dalam DRP bulan '+esc2(month)+' '+esc2(year)+', baik Kunjungan Lapangan maupun Bukan Kunjungan Lapangan.</p>'+
      '<table class="result-table"><thead><tr><th>No</th><th>Tanggal</th><th>Status</th><th>Jenis Kegiatan</th><th>Desa/Lokasi</th><th>Deskripsi DRP</th></tr></thead><tbody>'+
      allActs.map((x,i)=>'<tr><td>'+esc2(x.no||i+1)+'</td><td>'+esc2(dLong(x.tanggal))+'</td><td>'+esc2(x.kunjungan?'Kunjungan Lapangan':'Bukan Kunjungan Lapangan')+'</td><td>'+esc2(x.jenis||'-')+'</td><td>'+esc2(window.locationVillage?window.locationVillage(x.lokasi):x.lokasi||'-')+'</td><td>'+esc2(x.deskripsi||x.judul||'-')+'</td></tr>').join('')+
      '</tbody></table></section>';
  }

  function buildAllActivityDocumentation(allActs){
    const photosAll=((typeof activityPhotos!=='undefined')?activityPhotos:[]);
    const used=new Set();
    const cells = allActs.map((act, idx)=>{
      const photos = photosAll.filter((p,pi)=>{
        const matched=(p.matchedActivityIndex===idx);
        const byDate=(p.matchedActivityIndex==null && p.date && ((typeof sameDayMonth==='function')?sameDayMonth(p.date,act.tanggal):false));
        if((matched||byDate)&&!used.has(pi)){used.add(pi);return true} return false;
      });
      const photoHtml = photos.length
        ? photos.map(p=>'<div class="master-doc-photo"><img src="'+p.url+'" alt="Dokumentasi"></div>').join('')
        : '<div class="master-doc-empty">Foto dokumentasi belum tersedia untuk kegiatan ini.</div>';
      const village = (typeof locationVillage==='function'?locationVillage(act.lokasi):String(act.lokasi||'-'));
      const date = act.tanggal ? dLong(act.tanggal) : '-';
      const activity = (typeof shortActivityTitle==='function' ? shortActivityTitle(act) : String(act.judul||act.deskripsi||'-').replace(/\s+/g,' ').trim());
      return '<td class="master-doc-cell"><div class="master-doc-info"><div>Lokasi: <b>'+esc2(village)+'</b></div><div>Tanggal: <b>'+esc2(date)+'</b></div><div>Kegiatan: <b>'+esc2(activity)+'</b></div></div><div class="master-doc-photos">'+photoHtml+'</div></td>';
    });
    const rows=[];
    for(let i=0;i<cells.length;i+=2) rows.push('<tr>'+cells[i]+(cells[i+1]||'<td class="master-doc-cell empty"></td>')+'</tr>');
    const remaining=photosAll.filter((p,pi)=>!used.has(pi));
    if(remaining.length){
      for(let i=0;i<remaining.length;i+=2){
        const make=p=>'<td class="master-doc-cell"><div class="master-doc-info"><div>Lokasi: <b>Belum terdeteksi</b></div><div>Tanggal: <b>'+esc2(p.date||'-')+'</b></div><div>Kegiatan: <b>Dokumentasi belum dicocokkan</b></div></div><div class="master-doc-photos"><div class="master-doc-photo"><img src="'+p.url+'" alt="Dokumentasi"></div></div></td>';
        rows.push('<tr>'+make(remaining[i])+(remaining[i+1]?make(remaining[i+1]):'<td class="master-doc-cell empty"></td>')+'</tr>');
      }
    }
    return '<table class="master-doc-table"><tbody>'+rows.join('')+'</tbody></table>';
  }

  window.renderReportFromNarratives = function(nar){
    const c=(typeof reportContext!=='undefined')?reportContext:null;
    if(!c)return;
    const {nama,posisi,nik,jabatan,kec,kab,prov,month,year,acts}=c;
    const allActs=safeArr(c.allActs).length?safeArr(c.allActs):safeArr(acts);
    const signDate=allActs.length?dLong(allActs[allActs.length-1].tanggal):('30 '+month+' '+year);
    const lp=(typeof logoPhoto!=='undefined')?logoPhoto:''; const logo=lp?'<img class="cover-logo" src="'+lp+'" alt="Logo Kemendesa">':'<div class="cover-logo placeholder">LOGO KEMENDESA PDT</div>';

    // COVER: original master is A4 LANDSCAPE.
    const cover='<section class="'+reportPageClass('landscape')+' master-cover"><div class="cover-head">'+
      '<div class="cover-instansi">KEMENTERIAN DESA DAN PEMBANGUNAN DAERAH TERTINGGAL REPUBLIK INDONESIA<br><br>BADAN PENGEMBANGAN SUMBERDAYA MANUSIA DAN PEMBERDAYAAN<br>MASYARAKAT DESA DAN DAERAH TERTINGGAL</div>'+
      logo+
      '<div class="cover-title">LAPORAN KUNJUNGAN LAPANGAN '+monthUpper(month)+'</div>'+
      '<div class="cover-name">'+esc2(nama).toUpperCase()+'</div>'+
      '<div class="cover-position">'+esc2(posisi).toUpperCase()+'</div>'+
      '<div class="cover-region">KECAMATAN '+esc2(kec).toUpperCase()+'<br>KABUPATEN '+esc2(kab).toUpperCase()+'<br>PROVINSI '+esc2(prov).toUpperCase()+'<br><br>TAHUN '+esc2(year)+'</div>'+
      '<div class="cover-footer-title">LAPORAN KUNJUNGAN LAPANGAN BULANAN</div></div></section>';

    // A + B: original master uses A4 PORTRAIT.
    const ident='<section class="'+reportPageClass('portrait')+'">'+
      '<div>LAPORAN KUNJUNGAN LAPANGAN BULANAN</div><div>PENDAMPING DESA<br>BULAN '+monthUpper(month)+' TAHUN '+esc2(year)+'</div><hr>'+
      '<h3>A. Identitas</h3><table class="identity-table">'+
      '<tr><td>NIK</td><td>: '+esc2(nik)+'</td></tr>'+
      '<tr><td>Nama Lengkap</td><td>: <b>'+esc2(nama).toUpperCase()+'</b></td></tr>'+
      '<tr><td>Kecamatan</td><td>: '+esc2(kec)+'</td></tr>'+
      '<tr><td>Kabupaten</td><td>: '+esc2(kab)+'</td></tr>'+
      '<tr><td>Provinsi</td><td>: '+esc2(prov)+'</td></tr>'+
      '<tr><td>Posisi</td><td>: '+esc2(posisi)+'</td></tr>'+
      '<tr><td>Jabatan</td><td>: '+esc2(jabatan)+'</td></tr></table>'+
      '<h3>B. Waktu Pelaksanaan Kunjungan Lapangan</h3>'+
      '<table class="wide-table"><thead><tr><th>Hari ke</th><th>Waktu (Tgl/Bln/Thn)</th><th colspan="2">Lokasi Kunjungan</th></tr><tr><th></th><th></th><th>Kecamatan</th><th>Desa</th></tr></thead><tbody>'+
      ((typeof buildVisitDays==='function'?buildVisitDays(acts):''))+
      '</tbody><tfoot><tr><th colspan="4">Total Hari Kunjungan Lapangan Bulan '+esc2(month)+' Tahun '+esc2(year)+' : '+((typeof uniqueVisitDays==='function'?uniqueVisitDays(acts):acts.length))+' Hari</th></tr></tfoot></table></section>';

    // C: original master is A4 PORTRAIT and starts on a new page.
    const csec='<section class="'+reportPageClass('portrait')+'"><h3>C. Tujuan Kunjungan Lapangan</h3>'+
      '<p>Kunjungan lapangan dilaksanakan untuk melakukan pendampingan, monitoring, verifikasi, dan evaluasi terhadap kegiatan yang tercatat dalam DRP bulan '+esc2(month)+' '+esc2(year)+'. Secara khusus, kunjungan bertujuan untuk:</p>'+
      '<ol>'+safeArr(nar?.tujuan).map(x=>'<li>'+esc2(x)+'</li>').join('')+'</ol></section>';

    // D: original master is A4 LANDSCAPE because the table is wide.
    const dsec='<section class="'+reportPageClass('landscape')+'"><h3>D. Hasil Kunjungan Lapangan</h3>'+
      '<table class="result-table"><thead><tr><th>No</th><th>Tanggal</th><th>Desa</th><th>Kegiatan</th></tr></thead><tbody>'+
      ((typeof buildVisitRows==='function'?buildVisitRows(acts):''))+
      '</tbody></table>'+
      '<p><b>Hasil kunjungan lapangan menunjukkan beberapa capaian dan temuan sebagai berikut:</b></p>'+
      '<ol>'+safeArr(nar?.hasil).map(x=>'<li>'+esc2(x)+'</li>').join('')+'</ol></section>';

    // E + F: original master is A4 PORTRAIT.
    const ef='<section class="'+reportPageClass('portrait')+'"><h3>E. Langkah Tindak Lanjut Penanganan Lapangan</h3>'+
      '<p>Berdasarkan hasil kunjungan lapangan selama bulan '+esc2(month)+' '+esc2(year)+', tindak lanjut diarahkan pada penyelesaian temuan, penyempurnaan data, pemantauan kegiatan pembangunan, penguatan administrasi, serta koordinasi dengan unsur terkait sesuai kondisi yang tercatat dalam DRP.</p>'+
      '<ol>'+safeArr(nar?.follow).map(x=>'<li>'+esc2(x)+'</li>').join('')+'</ol>'+
      '<h3>F. Rekomendasi</h3><p>Berdasarkan keseluruhan kegiatan dan hasil kunjungan lapangan, rekomendasi disusun sebagai bahan perbaikan dan tindak lanjut pada periode berikutnya.</p>'+
      '<ol>'+safeArr(nar?.recs).map(x=>'<li>'+esc2(x)+'</li>').join('')+'</ol>'+
      '<p><b>Kesimpulan:</b> Secara keseluruhan, kunjungan lapangan bulan '+esc2(month)+' '+esc2(year)+' diarahkan pada kegiatan yang tercatat dalam DRP, dengan tindak lanjut dan rekomendasi yang menyesuaikan hasil verifikasi, monitoring, koordinasi, dan kondisi yang ditemukan di lapangan.</p>'+
      '<div class="signature"><p>Sendana, '+esc2(signDate)+'</p><p>Penyusun Laporan</p><br><b>'+esc2(nama).toUpperCase()+'</b></div></section>';

    // G: original master is A4 LANDSCAPE. Keep G as documentation, but include ALL DRP activities.
    const g='<section class="'+reportPageClass('portrait')+'"><h3>G. Dokumentasi Kunjungan Lapangan</h3>'+
      '<p class="small master-note">Dokumentasi disusun mengikuti urutan kegiatan pada DRP. Seluruh aktivitas DRP tetap dicatat; apabila foto belum tersedia, ruang dokumentasi diberi keterangan.</p>'+
      buildAllActivityDocumentation(allActs)+'</section>';

    // H: appendix keeps the original A-G order intact while satisfying the requirement that all 24 DRP activities are visible in one final report.
    const h=buildAllActivityRecap(allActs,month,year);

    const html='<div class="print-report">'+cover+ident+csec+dsec+ef+g+h+'</div>';
    reportHtml=html;
    const rp=document.getElementById('reportPrint'); if(rp)rp.innerHTML=html;
    const dr=document.getElementById('docResult2'); if(dr)dr.innerHTML='<div class="card no-print"><h3>Pratinjau Laporan Sesuai Format Master</h3>'+html+'</div>';
    const ra=document.getElementById('reportActions'); if(ra)ra.classList.remove('hide');
    reportText=rp?rp.innerText:'';
    if(typeof window.page==='function')window.page('laporan');
    window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
  };
})();