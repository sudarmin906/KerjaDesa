// KerjaDesa Pro - Desa Controller

const desaController = {
  getAll: async (req, res) => {
    res.json({
      status: true,
      message: 'Daftar data desa',
      data: []
    });
  },

  create: async (req, res) => {
    res.json({
      status: true,
      message: 'Data desa berhasil disiapkan untuk disimpan',
      data: req.body
    });
  },

  update: async (req, res) => {
    res.json({
      status: true,
      message: 'Data desa berhasil diperbarui'
    });
  },

  remove: async (req, res) => {
    res.json({
      status: true,
      message: 'Data desa berhasil dihapus'
    });
  }
};

module.exports = desaController;
