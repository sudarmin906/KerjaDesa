const { readStore, create } = require('../database/jsonStore');

function writeAudit({ user, action, resource, recordId = null, details = null }) {
  try {
    create('audit_log', {
      user_id: user?.id || null,
      username: user?.username || '',
      role: user?.role || '',
      action,
      resource,
      record_id: recordId,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Audit log gagal:', error.message);
  }
}

function listAudit(limit = 100) {
  const store = readStore();
  return (store.audit_log || []).slice().reverse().slice(0, limit);
}

module.exports = { writeAudit, listAudit };
