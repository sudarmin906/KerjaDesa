// KerjaDesa Pro - Kegiatan Database Controller
// Modul integrasi kegiatan dengan database

exports.getKegiatan = async (req,res)=>{
 res.json({status:'ready',module:'kegiatan'});
};

exports.createKegiatan = async (req,res)=>{
 res.json({status:'created',data:req.body});
};
