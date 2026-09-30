// KerjaDesa Frontend API Integration Foundation
// Menyiapkan koneksi frontend ke backend API.

const KerjaDesaAPI = {
  baseURL: '/api',

  async request(endpoint, options = {}) {
    const response = await fetch(this.baseURL + endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    return response.json();
  }
};

window.KerjaDesaAPI = KerjaDesaAPI;
