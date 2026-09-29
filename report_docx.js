/* KerjaDesa - native DOCX report exporter
   Uses the real WordprocessingML section model so mixed portrait/landscape
   survives Word/WPS/LibreOffice instead of relying on .doc HTML @page CSS. */
(function(){
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const A='http://schemas.openxmlformats.org/drawingml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  function xe(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
  function escText(s){return xe(String(s??'').replace(/\u00ad/g,''))}
  function rtext(text,{bold=false,size=22,italic=false}={}){
    return '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="'+size+'"/><w:szCs w:val="'+size+'"/>'+(bold?'<w:b/>':'')+(italic?'<w:i/>':'')+'</w:rPr><w:t xml:space="preserve">'+escText(text)+'</w:t></w:r>';
  }
  function para(parts='',o={}){
    const before=o.before??0,after=o.after??0,line=o.line??240;
    let ppr='<w:pPr><w:spacing w:before="'+before+'" w:after="'+after+'" w:line="'+line+'" w:lineRule="auto"/>';
    if(o.align)ppr+='<w:jc w:val="'+o.align+'"/>';
    if(o.keepNext)ppr+='<w:keepNext/>';
    if(o.keepLines)ppr+='<w:keepLines/>';
    if(o.indent)ppr+='<w:ind w:left="'+o.indent+'"/>';
    if(o.pageBreakBefore)ppr+='<w:pageBreakBefore/>';
    ppr+='</w:pPr>';
    return '<w:p>'+ppr+parts+'</w:p>';
  }
  function textPara(text,o={}){
    const parts=String(text??'').split(/\n/).map((x,i)=>(i?'<w:r><w:br/></w:r>':'')+rtext(x,o)).join('');
    return para(parts,o);
  }
  function blank(n=1){let s='';for(let i=0;i<n;i++)s+=para('',{after:0,line:1});return s}

  const borders='<w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="555555"/><w:left w:val="single" w:sz="6" w:space="0" w:color="555555"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="555555"/><w:right w:val="single" w:sz="6" w:space="0" w:color="555555"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="555555"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="555555"/></w:tblBorders>';

  function cell(content,width,o={}){
    const span=o.span?'<w:gridSpan w:val="'+o.span+'"/>':'';
    const shade=o.shade?'<w:shd w:fill="'+o.shade+'"/>':'';
    const valign=o.valign?'<w:vAlign w:val="'+o.valign+'"/>':'';
    return '<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/>'+span+shade+valign+'</w:tcPr>'+content+'</w:tc>';
  }
  function row(cells,{header=false,height=null}={}){
    let trPr='<w:trPr><w:cantSplit/>'+(header?'<w:tblHeader/>':'')+(height?'<w:trHeight w:val="'+height+'" w:hRule="atLeast"/>':'')+'</w:trPr>';
    return '<w:tr>'+trPr+cells.join('')+'</w:tr>';
  }
  function table(rows,widths,{autofit=false}={}){
    return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'+borders+'<w:tblLayout w:type="'+(autofit?'autofit':'fixed')+'"/></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+rows.join('')+'</w:tbl>';
  }
  function inlineField(){}
  function imgSize(dataUrl,maxWIn,maxHIn){
    return new Promise(resolve=>{
      const im=new Image();
      im.onload=()=>{
        const w=im.naturalWidth||1,h=im.naturalHeight||1;
        const scale=Math.min((maxWIn*96)/w,(maxHIn*96)/h);
        resolve({w:Math.max(0.1,w*scale/96),h:Math.max(0.1,h*scale/96)});
      };
      im.onerror=()=>resolve({w:maxWIn,h:maxHIn});
      im.src=dataUrl;
    });
  }

  function exporter(){
    const zip=new JSZip(), rels=[], images=[], ridMap=new Map(), imgCounter={n:0};
    async function regImage(dataUrl,ext){
      if(!dataUrl)return null;
      const key=dataUrl.slice(0,80)+'|'+dataUrl.length;
      if(ridMap.has(key))return ridMap.get(key);
      const m=String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if(!m)return null;
      const mime=m[1].toLowerCase(), b64=m[2], ext2=ext||(mime.includes('png')?'png':mime.includes('gif')?'gif':'jpg');
      const id='rIdImg'+(++imgCounter.n),name='image'+imgCounter.n+'.'+ext2;
      zip.file('word/media/'+name,b64,{base64:true});
      rels.push({id,type:R+'/image',target:'media/'+name});
      const keyobj={id,name,mime};
      ridMap.set(key,keyobj);images.push(keyobj);return keyobj;
    }
    async function drawing(dataUrl,maxWIn,maxHIn,ext){
      const im=await regImage(dataUrl,ext);if(!im)return '';
      const dim=await imgSize(dataUrl,maxWIn,maxHIn),cx=Math.round(dim.w*914400),cy=Math.round(dim.h*914400),docId=100+images.length;
      return '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+docId+'" name="Picture '+docId+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+docId+'" name="'+xe(im.name)+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+im.id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }
    function sectPr(orientation='portrait',next=true){
      const land=orientation==='landscape',w=land?15840:12240,h=land?12240:15840;
      const t=land?1800:851,l=land?851:1800;
      return '<w:sectPr>'+(next?'<w:type w:val="nextPage"/>':'')+'<w:pgSz w:w="'+w+'" w:h="'+h+'"'+(land?' w:orient="landscape"':'')+'/>'+'<w:pgMar w:top="'+t+'" w:right="'+l+'" w:bottom="'+t+'" w:left="'+l+'" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
    }
    function sectionEnd(orientation,next=true){return '<w:p><w:pPr>'+sectPr(orientation,next)+'</w:pPr></w:p>'}
    function docHeader(){return '<w:styles xmlns:w="'+W+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style></w:styles>'}
    function relXml(){
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+R+'/styles" Target="styles.xml"/>'+rels.map(x=>'<Relationship Id="'+x.id+'" Type="'+x.type+'" Target="'+x.target+'"/>').join('')+'</Relationships>';
    }
    function contentTypes(){
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    }
    function packageRels(){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'}
    function coreXml(){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Laporan Kunjungan Lapangan</dc:title><dc:creator>SUDARMIN ARIPUDDIN</dc:creator></cp:coreProperties>'}
    function appXml(){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>KerjaDesa</Application></Properties>'}

    async function build(){
      const d=data.docs||{},drp=d.drp?.parsed,h=drp?.header||{};if(!drp||!drp.all?.length)throw new Error('Upload dan proses DRP terlebih dahulu.');
      const nama='SUDARMIN ARIPUDDIN',posisi='Pendamping Desa',nik='760503312910050',jabatan='Pendamping lokal Desa',kec='SENDANA',kab='MAJENE',prov='SULAWESI BARAT';
      const periode=h.periode||periodLabel(),month=monthNameFromPeriod(periode),year=yearFromPeriod(periode);
      const acts=drp.all.slice().sort((a,b)=>{const da=String(a.tanggal||'').split('/').reverse().join('');const db=String(b.tanggal||'').split('/').reverse().join('');return da.localeCompare(db)||Number(a.no||0)-Number(b.no||0)});
      const nar=deriveNarratives(acts);
      const W_ID=[2400,6240],W_B=[1350,2400,1800,3090],W_D=[800,1800,2200,9338],W_G=[4320,4320];

      let body='';

      /* SECTION 1 : PORTRAIT = cover + A/B + C */
      body+=textPara('KEMENTERIAN DESA DAN PEMBANGUNAN DAERAH TERTINGGAL REPUBLIK INDONESIA',{align:'center',bold:true,size:15,before:20,after:20,line:170});
      body+=textPara('BADAN PENGEMBANGAN SUMBERDAYA MANUSIA DAN PEMBERDAYAAN MASYARAKAT DESA DAN DAERAH TERTINGGAL',{align:'center',bold:true,size:14,before:0,after:0,line:170});
      body+=blank(10);
      if(logoPhoto){body+=para(await drawing(logoPhoto,1.5,1.5,'png'),{align:'center',after:80})}else body+=blank(6);
      body+=blank(12);
      body+=textPara('LAPORAN KUNJUNGAN LAPANGAN '+month.toUpperCase(),{align:'center',bold:true,size:16,before:0,after:360,line:200});
      body+=textPara(nama,{align:'center',bold:true,size:16,before:0,after:120});
      body+=textPara(posisi.toUpperCase(),{align:'center',bold:true,size:14,before:0,after:240});
      body+=textPara('KECAMATAN '+kec+'\\nKABUPATEN '+kab+'\\nPROVINSI '+prov+'\\n\\nTAHUN '+year,{align:'center',size:13,before:900,after:0,line:260});
      body+=textPara('LAPORAN KUNJUNGAN LAPANGAN BULANAN',{align:'center',bold:true,size:15,before:900,after:600});

      body+=textPara('LAPORAN KUNJUNGAN LAPANGAN BULANAN',{align:'center',bold:true,size:22,before:120,after:100});
      body+=textPara('PENDAMPING DESA',{align:'left',size:20,after:0});
      body+=textPara('BULAN '+month.toUpperCase()+' TAHUN '+year,{align:'left',size:20,after:140});
      body+=textPara('____________________________________________',{align:'left',size:18,after:140});

      body+=textPara('A. Identitas',{align:'left',bold:true,size:22,before:100,after:100});
      const idrows=[
        ['NIK',' : '+nik],['Nama Lengkap',' : '+nama],['Kecamatan',' : '+kec],['Kabupaten',' : '+kab],['Provinsi',' : '+prov],['Posisi',' : '+posisi],['Jabatan',' : '+jabatan]
      ].map(x=>row([cell(textPara(x[0],{size:19}),2400),cell(textPara(x[1],{bold:x[0]==='Nama Lengkap',size:19}),6240)]));
      body+=table(idrows,W_ID);

      body+=textPara('B. Waktu Pelaksanaan Kunjungan Lapangan',{align:'left',bold:true,size:22,before:280,after:120});
      const seen=new Set(),visit=[];
      for(const a of acts){const k=dateKey(a.tanggal);if(k&&!seen.has(k)){seen.add(k);visit.push(a)}}
      const head1=row([cell(textPara('Hari ke',{bold:true,size:18,align:'center'}),1350),cell(textPara('Waktu (Tgl/Bln/Thn)',{bold:true,size:18,align:'center'}),2400),cell(textPara('Lokasi Kunjungan',{bold:true,size:18,align:'center'}),4890,{span:2})],{header:true});
      const head2=row([cell(textPara('',{size:18}),1350),cell(textPara('',{size:18}),2400),cell(textPara('Kecamatan',{bold:true,size:18,align:'center'}),1800),cell(textPara('Desa',{bold:true,size:18,align:'center'}),3090)],{header:true});
      const brow=[head1,head2];
      visit.forEach((x,i)=>brow.push(row([cell(textPara('Hari ke-'+(i+1),{size:17}),1350),cell(textPara(dateLongId(x.tanggal),{size:17}),2400),cell(textPara(kec,{size:17}),1800),cell(textPara(locationVillage(x.lokasi),{size:17}),3090)])));
      brow.push(row([cell(textPara('Total Hari Kunjungan Lapangan Bulan '+month+' Tahun '+year+' : '+visit.length+' Hari',{bold:true,size:17,align:'center'}),8640,{span:4})]));
      body+=table(brow,W_B);

      body+=textPara('C. Tujuan Kunjungan Lapangan',{align:'left',bold:true,size:22,before:360,after:100});
      body+=textPara('Kunjungan lapangan dilaksanakan untuk melakukan pendampingan secara langsung kepada Pemerintah Desa dan masyarakat dalam memastikan proses pembangunan, perencanaan, pelaksanaan kegiatan, serta pengelolaan program desa berjalan sesuai dengan rencana dan ketentuan yang berlaku. Kunjungan dilakukan dengan melihat kondisi faktual di lapangan, melakukan koordinasi dengan pihak terkait, mencermati perkembangan kegiatan, serta memberikan pendampingan terhadap hal-hal yang memerlukan tindak lanjut.',{size:21,align:'both',line:300,after:120});
      nar.tujuan.forEach((x,i)=>{body+=textPara((i+1)+'. '+x,{size:21,align:'both',line:300,after:100})});

      body+=sectionEnd('portrait',true);

      /* SECTION 2 : LANDSCAPE = D only */
      body+=textPara('D. Hasil Kunjungan Lapangan',{align:'left',bold:true,size:22,before:0,after:120});
      const drows=[row([cell(textPara('No',{bold:true,size:18,align:'center'}),800),cell(textPara('Tanggal',{bold:true,size:18,align:'center'}),1800),cell(textPara('Desa',{bold:true,size:18,align:'center'}),2200),cell(textPara('Kegiatan',{bold:true,size:18,align:'center'}),9338)],{header:true})];
      acts.forEach((x,i)=>drows.push(row([cell(textPara(String(i+1),{size:17,align:'center'}),700),cell(textPara(dateLongId(x.tanggal),{size:17}),1500),cell(textPara(locationVillage(x.lokasi),{size:17}),1900),cell(textPara(String(x.deskripsi||'').replace(/\\s+/g,' ').trim(),{size:17,align:'both',line:235}) ,5300)])));
      body+=table(drows,W_D);
      body+=textPara('Hasil kunjungan lapangan menunjukkan beberapa capaian dan temuan sebagai berikut:',{bold:true,size:21,align:'both',line:280,before:140,after:100});
      nar.hasil.forEach((x,i)=>body+=textPara((i+1)+'. '+String(x).replace(/^Kegiatan\\s+\\d+\\s*/i,'').replace(/^menunjukkan\\s+/i,''),{size:21,align:'both',line:300,after:100}));
      body+=sectionEnd('landscape',true);

      /* SECTION 3 : PORTRAIT = E + F */
      body+=textPara('E. Langkah Tindak Lanjut Penanganan Lapangan',{align:'left',bold:true,size:22,before:0,after:120});
      body+=textPara('Berdasarkan hasil kunjungan lapangan selama Bulan '+month+' '+year+', tindak lanjut yang dilakukan difokuskan pada penyelesaian temuan, penyempurnaan data, pemantauan kegiatan pembangunan, penguatan administrasi, serta koordinasi dengan unsur terkait sesuai kondisi yang tercatat dalam DRP.',{size:21,align:'both',line:300,after:120});
      nar.follow.forEach((x,i)=>body+=textPara((i+1)+'. '+x,{size:21,align:'both',line:300,after:100}));
      body+=textPara('F. Rekomendasi',{align:'left',bold:true,size:22,before:250,after:120});
      body+=textPara('Berdasarkan keseluruhan kegiatan dan hasil kunjungan lapangan, rekomendasi disusun sebagai bahan perbaikan dan tindak lanjut pada periode berikutnya.',{size:21,align:'both',line:300,after:120});
      nar.recs.forEach((x,i)=>body+=textPara((i+1)+'. '+x,{size:21,align:'both',line:300,after:100}));
      body+=textPara('Kesimpulan: Secara keseluruhan, kunjungan lapangan bulan '+month+' '+year+' diarahkan pada kegiatan yang tercatat dalam DRP, dengan tindak lanjut dan rekomendasi yang menyesuaikan hasil verifikasi, monitoring, koordinasi, dan kondisi yang ditemukan di lapangan.',{size:21,align:'both',line:300,after:120});
      body+=textPara('Sendana, 30 '+month+' '+year,{align:'center',size:21,before:300,after:100});
      body+=textPara('Penyusun Laporan',{align:'center',size:21,after:280});
      body+=textPara(nama,{align:'center',bold:true,size:21,after:300});
      body+=sectionEnd('portrait',true);

      /* SECTION 4 : PORTRAIT = G in 2-column 2x2 tables, 4 activity dates/page */
      body+=textPara('G. Dokumentasi Kunjungan Lapangan',{align:'left',bold:true,size:22,before:0,after:120});
      const photoBy={};(activityPhotos||[]).forEach(p=>{if(p.date)(photoBy[dateKey(p.date)]??=[]).push(p)});
      const docActs=[];const docSeen=new Set();
      for(const a of acts){const k=dateKey(a.tanggal);if(photoBy[k]?.length&&!docSeen.has(k)){docSeen.add(k);docActs.push(a)}}
      for(let base=0;base<docActs.length;base+=4){
        const chunk=docActs.slice(base,base+4);
        if(base>0)body+=para('<w:r><w:br w:type="page"/></w:r>',{after:0});
        for(let j=0;j<chunk.length;j+=2){
          const pair=[chunk[j],chunk[j+1]].filter(Boolean);
          const top=pair.map(a=>{const note=textPara('Lokasi: '+locationVillage(a.lokasi),{size:18,after:30})+textPara('Tanggal '+dateLongId(a.tanggal),{size:18,after:30})+textPara('Kegiatan : '+docActivityTitle(a.deskripsi),{size:18,after:0,line:230});return cell(note,4320,{valign:'top'})});
          if(pair.length===1)top.push(cell('',4320));
          const bot=[];
          for(const a of pair){
            const pics=photoBy[dateKey(a.tanggal)]||[];
            let pc='';
            for(const p of pics)pc+=para(await drawing(p.url,3.0,3.25,p.url.startsWith('data:image/png')?'png':'jpg'),{align:'center',after:30});
            bot.push(cell(pc||textPara('Dokumentasi tidak tersedia',{align:'center',size:18}),4320,{valign:'center'}));
          }
          if(pair.length===1)bot.push(cell('',4320));
          body+=table([row(top),row(bot)],W_G);
          body+=blank(2);
        }
      }
      body+=sectionEnd('portrait',false);

      const sectBody='<w:body xmlns:w="'+W+'" xmlns:r="'+R+'" xmlns:wp="'+WP+'" xmlns:a="'+A+'">'+body+'</w:body>';
      const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="'+W+'" xmlns:r="'+R+'" xmlns:wp="'+WP+'" xmlns:a="'+A+'">'+sectBody+'</w:document>';
      zip.file('[Content_Types].xml',contentTypes());
      zip.file('_rels/.rels',packageRels());
      zip.file('word/document.xml',documentXml);
      zip.file('word/styles.xml',docHeader());
      zip.file('word/_rels/document.xml.rels',relXml());
      zip.file('docProps/core.xml',coreXml());
      zip.file('docProps/app.xml',appXml());
      return zip;
    }
    return build();
  }

  window.downloadWord=async function(){
    try{
      if(window.kdHasMasterTemplate && await window.kdHasMasterTemplate()){
        const zip=await window.kdExportMasterReport();
        const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
        const d=data.docs||{},period=d.drp?.parsed?.header?.periode||periodLabel(),month=monthNameFromPeriod(period);
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Laporan_Kunjungan_Lapangan_'+month+'_'+yearFromPeriod(period)+'.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return;
      }
      const zip=await exporter();
      const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
      const d=data.docs||{},period=d.drp?.parsed?.header?.periode||periodLabel(),month=monthNameFromPeriod(period);
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Laporan_Kunjungan_Lapangan_'+month+'_2026.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);
    }catch(e){console.error(e);alert('Gagal membuat DOCX: '+(e?.message||e))}
  };
})();