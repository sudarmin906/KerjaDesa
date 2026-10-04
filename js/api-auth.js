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

  async login(username, password, rememberMe = false) {
    let response;
    try {
      response = await fetch(this.baseURL() + '/auth/login', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ username, password, remember_me: !!rememberMe })
      });
    } catch (error) {
      const err = new Error('Tidak dapat terhubung ke server.');
      err.code = 'AUTH_NETWORK_ERROR';
      throw err;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      const err = new Error(data.message || 'Server authentication sedang bermasalah. Silakan coba lagi.');
      err.status = response.status;
      err.code = data.code || 'AUTH_UNKNOWN_ERROR';
      throw err;
    }

    sessionStorage.removeItem('kd_auth_token');
    sessionStorage.setItem('kd_csrf_token', data.csrf_token || '');
    sessionStorage.setItem('kd_user', JSON.stringify(data.user || {}));
    sessionStorage.setItem('kd_login', '1');
    sessionStorage.setItem('kd_remember_me', data.remember_me ? '1' : '0');

    // Passwords are never written to KerjaDesa storage. When requested,
    // delegate credential persistence to the browser/OS password manager.
    if (rememberMe) void this.saveBrowserCredential(username, password);
    return data;
  },

  async me() {
    const response = await fetch(this.baseURL() + '/auth/me', {
      credentials: 'include',
      cache: 'no-store'
    });
    if (response.status === 401) return null;
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.message || ('Pemeriksaan sesi gagal (HTTP ' + response.status + ').'));
      err.status = response.status;
      err.code = response.status >= 500 ? 'AUTH_SESSION_CHECK_FAILED' : 'AUTH_SESSION_ERROR';
      throw err;
    }
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
    sessionStorage.removeItem('kd_remember_me');
  }
};

window.KerjaDesaAuthAPI = KerjaDesaAuthAPI;
