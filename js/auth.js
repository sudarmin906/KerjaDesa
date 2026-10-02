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
    sessionStorage.removeItem('kd_login');
    sessionStorage.removeItem('kd_auth_token');
    sessionStorage.removeItem('kd_user');
    location.reload();
  },

  current(){
    try{
      return JSON.parse(sessionStorage.getItem('kd_user') || 'null');
    }catch(_){
      return null;
    }
  }
};

window.KerjaDesaAuth = KerjaDesaAuth;
