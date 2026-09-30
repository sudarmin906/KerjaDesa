// KerjaDesa Pro - Role Access Controller
// Menyiapkan aturan hak akses multi user.

const roles = {
  ADMIN: ["users", "desa", "kegiatan", "monitoring", "dokumen", "laporan"],
  PLD: ["kegiatan", "monitoring", "laporan", "dokumen"],
  PEMDES: ["desa", "monitoring", "dokumen"],
  OPERATOR: ["kegiatan", "dokumen"]
};

function getAccess(role) {
  return roles[role] || [];
}

module.exports = { getAccess, roles };
