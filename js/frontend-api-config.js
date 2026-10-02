// KerjaDesa Pro Frontend API Client
// V30: server-backed CRUD + safe offline fallback.

const KerjaDesaAPI = {
  baseURL: window.KERJADESA_API_BASE || '/api',

  async request(endpoint, options = {}) {
    const headers = { ...options.headers };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const csrf=(window.KerjaDesaAuthAPI?.csrfToken?.()||'');
    const method=String(options.method||'GET').toUpperCase();
    if(!['GET','HEAD','OPTIONS'].includes(method) && csrf) headers['X-CSRF-Token']=csrf;

    const response = await fetch(this.baseURL + endpoint, { ...options, credentials:'include', headers });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionStorage.removeItem('kd_login');
      sessionStorage.removeItem('kd_auth_token');
      sessionStorage.removeItem('kd_csrf_token');
      sessionStorage.removeItem('kd_user');
    }
    if (!response.ok) {
      const error = new Error(data.message || 'Permintaan API gagal.');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  get(resource, id = null) {
    return this.request('/' + resource + (id ? '/' + encodeURIComponent(id) : ''));
  },

  create(resource, payload) {
    return this.request('/' + resource, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  update(resource, id, payload) {
    return this.request('/' + resource + '/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  remove(resource, id) {
    return this.request('/' + resource + '/' + encodeURIComponent(id), {
      method: 'DELETE'
    });
  },

  async syncResource(resource, localItems, mapItem = item => item) {
    const result = { synced: [], failed: [] };
    for (const item of localItems || []) {
      try {
        const payload = mapItem(item);
        const remote = await this.create(resource, payload);
        result.synced.push({ local: item, remote: remote.data });
      } catch (error) {
        result.failed.push({ local: item, error: error.message });
      }
    }
    return result;
  }
};

window.KerjaDesaAPI = KerjaDesaAPI;
window.KERJADESA_API_BASE = KerjaDesaAPI.baseURL;
