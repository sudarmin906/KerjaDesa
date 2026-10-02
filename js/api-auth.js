// KerjaDesa Pro Authentication Connector
// Server-backed session with offline-safe fallback handled by index.html.

const KerjaDesaAuthAPI = {
  baseURL() {
    return window.KERJADESA_API_BASE || '/api';
  },

  token() {
    return sessionStorage.getItem('kd_auth_token') || '';
  },

  async login(username, password) {
    const response = await fetch(this.baseURL() + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Login gagal');
    }
    sessionStorage.setItem('kd_auth_token', data.token || '');
    sessionStorage.setItem('kd_user', JSON.stringify(data.user || {}));
    sessionStorage.setItem('kd_login', '1');
    return data;
  },

  async me() {
    const token = this.token();
    if (!token) return null;
    const response = await fetch(this.baseURL() + '/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  },

  async logout() {
    const token = this.token();
    if (token) {
      try {
        await fetch(this.baseURL() + '/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        });
      } catch (_) {}
    }
    sessionStorage.removeItem('kd_login');
    sessionStorage.removeItem('kd_auth_token');
    sessionStorage.removeItem('kd_user');
  }
};

window.KerjaDesaAuthAPI = KerjaDesaAuthAPI;
