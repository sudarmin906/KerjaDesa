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

  async saveBrowserCredential(username, password) {
    // Never store the plaintext password in KerjaDesa localStorage/sessionStorage.
    // Delegate credential storage to the browser/OS password manager.
    try {
      if (!window.isSecureContext || !navigator.credentials || !window.PasswordCredential) return false;
      const credential = new PasswordCredential({
        id: String(username || ''),
        password: String(password || ''),
        name: String(username || '')
      });
      await navigator.credentials.store(credential);
      return true;
    } catch (e) {
      console.warn('Browser password manager unavailable:', e);
      return false;
    }
  },

  async restoreBrowserCredential() {
    try {
      if (sessionStorage.getItem('kd_login') === '1') return null;
      if (!window.isSecureContext || !navigator.credentials) return null;
      const credential = await navigator.credentials.get({
        password: true,
        mediation: 'silent'
      });
      if (!credential || credential.type !== 'password') return null;
      return { username: credential.id || '', password: credential.password || '' };
    } catch (e) {
      return null;
    }
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
    // Saving is best-effort and browser-managed; it never blocks login.
    void this.saveBrowserCredential(username, password);
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
