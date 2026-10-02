// KerjaDesa Pro Authentication Connector
// Server-backed session with offline-safe fallback handled by index.html.

const KerjaDesaAuthAPI = {
  baseURL() {
    return window.KERJADESA_API_BASE || '/api';
  },

  token() {
    return '';
  },
  csrfToken() {
    return sessionStorage.getItem('kd_csrf_token') || '';
  },

  async login(username, password) {
    const response = await fetch(this.baseURL() + '/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Login gagal');
    }
    sessionStorage.removeItem('kd_auth_token');
    sessionStorage.setItem('kd_csrf_token', data.csrf_token || '');
    sessionStorage.setItem('kd_user', JSON.stringify(data.user || {}));
    sessionStorage.setItem('kd_login', '1');
    return data;
  },

  async me() {
    const response = await fetch(this.baseURL() + '/auth/me', {
      credentials: 'include'
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  },

  async logout() {
    try {
      await fetch(this.baseURL() + '/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': this.csrfToken() }
      });
    } catch (_) {}
    sessionStorage.removeItem('kd_login');
    sessionStorage.removeItem('kd_auth_token');
    sessionStorage.removeItem('kd_csrf_token');
    sessionStorage.removeItem('kd_user');
  }
};

window.KerjaDesaAuthAPI = KerjaDesaAuthAPI;
