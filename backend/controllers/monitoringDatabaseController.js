// KerjaDesa Pro - Monitoring Database Controller

exports.getMonitoring = async (req,res)=>{
 res.json({status:'ready',module:'monitoring'});
};

exports.createMonitoring = async (req,res)=>{
 res.json({status:'created',data:req.body});
};
