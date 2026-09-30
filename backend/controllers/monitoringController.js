// KerjaDesa Pro - Monitoring Controller
// Foundation for field monitoring module

const monitoringController = {
  list: async (req, res) => {
    res.json({
      status: true,
      module: 'monitoring',
      message: 'Monitoring lapangan ready'
    });
  },

  create: async (req, res) => {
    const data = req.body || {};
    res.json({
      status: true,
      message: 'Data monitoring diterima',
      data
    });
  },

  update: async (req, res) => {
    res.json({
      status: true,
      message: 'Monitoring diperbarui'
    });
  },

  remove: async (req, res) => {
    res.json({
      status: true,
      message: 'Monitoring dihapus'
    });
  }
};

module.exports = monitoringController;
