// KerjaDesa API Authentication Connector
// Menghubungkan frontend dengan backend authentication

const KerjaDesaAuth = {
  async login(username, password) {
    const API_URL = window.KERJADESA_API_URL || '/api/auth/login';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login gagal');
    }

    const data = await response.json();
    localStorage.setItem('kerjadesa_user', JSON.stringify(data));
    return data;
  },

  logout() {
    localStorage.removeItem('kerjadesa_user');
  }
};

window.KerjaDesaAuth = KerjaDesaAuth;
