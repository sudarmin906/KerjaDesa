/*
 CONNECT-02 - KerjaDesa Frontend Integration Bridge

 Fungsi:
 - Menyiapkan koneksi frontend ke API
 - Menjaga kompatibilitas versi lama
 - Tempat integrasi login/dashboard berikutnya
*/

window.KerjaDesaIntegration = {
  version: 'CONNECT-02',
  status: 'ready',
  api: window.KerjaDesaAPI || null,
  check(){
    return {
      version: this.version,
      apiReady: !!this.api
    };
  }
};
