// KerjaDesa Pro Frontend API Client
// Supports same-origin deployment and optional external backend.

const KerjaDesaAPI = {
  baseURL: window.KERJADESA_API_BASE || '/api',

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('kd_auth_token') || '';
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (token) headers.Authorization = 'Bearer ' + token;

    const response = await fetch(this.baseURL + endpoint, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('kd_login');
      localStorage.removeItem('kd_auth_token');
      localStorage.removeItem('kd_user');
    }
    if (!response.ok) {
      const error = new Error(data.message || 'Permintaan API gagal.');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }
};

window.KerjaDesaAPI = KerjaDesaAPI;
window.KERJADESA_API_BASE = KerjaDesaAPI.baseURL;
