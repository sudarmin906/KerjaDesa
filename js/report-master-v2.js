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
    const cells = allActs.map((act, idx)=>{
      const photos = ((typeof activityPhotos!=='undefined')?activityPhotos:[]).filter(p=>
        p.matchedActivityIndex===idx ||
        (p.matchedActivityIndex==null && p.date && ((typeof sameDayMonth==='function')?sameDayMonth(p.date,act.tanggal):false))
      );
      const photoHtml = photos.length
        ? photos.map(p=>'<div class="master-doc-photo"><img src="'+p.url+'" alt="Dokumentasi"></div>').join('')
        : '<div class="master-doc-empty">Foto dokumentasi belum tersedia untuk kegiatan ini.</div>';
      const village = (typeof locationVillage==='function'?locationVillage(act.lokasi):String(act.lokasi||'-'));
      const date = act.tanggal ? dLong(act.tanggal) : '-';
      const activity = String(act.deskripsi||act.judul||'-').replace(/\s+/g,' ').trim();
      return '<td class="master-doc-cell"><div class="master-doc-info"><div>Lokasi: <b>'+esc2(village)+'</b></div><div>Tanggal: <b>'+esc2(date)+'</b></div><div>Kegiatan: <b>'+esc2(activity)+'</b></div></div><div class="master-doc-photos">'+photoHtml+'</div></td>';
    });
    const rows=[];
    for(let i=0;i<cells.length;i+=2) rows.push('<tr>'+cells[i]+(cells[i+1]||'<td class="master-doc-cell empty"></td>')+'</tr>');
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
    const g='<section class="'+reportPageClass('landscape')+'"><h3>G. Dokumentasi Kunjungan Lapangan</h3>'+
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