// KerjaDesa Pro - Dokumen Digital Controller

exports.getDokumen = async (req,res)=>{
 res.json({status:'ready',module:'dokumen'});
};

exports.uploadDokumen = async (req,res)=>{
 res.json({status:'uploaded',data:req.body});
};
