/* KerjaDesa Pro Authentication Compatibility Layer
   Active authentication is server-backed through js/api-auth.js.
   This file keeps a small compatibility API for older UI code.
*/

const KerjaDesaAuth = {
  async login(username, password){
    if(window.KerjaDesaAuthAPI){
      const result=await window.KerjaDesaAuthAPI.login(username,password);
      return !!result?.success;
    }
    return false;
  },

  logout(){
    localStorage.removeItem('kd_login');
    localStorage.removeItem('kd_auth_token');
    localStorage.removeItem('kd_user');
    location.reload();
  },

  current(){
    try{
      return JSON.parse(localStorage.getItem('kd_user') || 'null');
    }catch(_){
      return null;
    }
  }
};

window.KerjaDesaAuth = KerjaDesaAuth;
