// KerjaDesa Pro - Kegiatan Controller
// Modul pengelolaan kegiatan desa

const kegiatanController = {
  list(req, res) {
    res.json({
      status: true,
      message: 'Data kegiatan KerjaDesa',
      data: []
    });
  },

  create(req, res) {
    res.json({
      status: true,
      message: 'Kegiatan berhasil disiapkan untuk disimpan'
    });
  },

  update(req, res) {
    res.json({
      status: true,
      message: 'Data kegiatan diperbarui'
    });
  },

  remove(req, res) {
    res.json({
      status: true,
      message: 'Data kegiatan dihapus'
    });
  }
};

module.exports = kegiatanController;
