const { create, list } = require('../database/store');

async function writeAudit({ user, action, resource, recordId = null, details = null }) {
  try {
    await create('audit_log', {
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

async function listAudit(limit = 100) {
  return (await list('audit_log')).slice().reverse().slice(0, limit);
}

module.exports = { writeAudit, listAudit };
