/* KerjaDesa Pro Authentication Module
   Upgrade Login v1
*/

const KerjaDesaAuth = {
  defaultUser: {
    username: "admin",
    password: "admin123",
    role: "Administrator"
  },

  init(){
    if(!localStorage.getItem("kerjadesa_users")){
      localStorage.setItem("kerjadesa_users", JSON.stringify([this.defaultUser]));
    }
  },

  login(username,password){
    const users = JSON.parse(localStorage.getItem("kerjadesa_users") || "[]");
    const user = users.find(u => u.username === username && u.password === password);
    if(user){
      localStorage.setItem("kerjadesa_session", JSON.stringify(user));
      return true;
    }
    return false;
  },

  logout(){
    localStorage.removeItem("kerjadesa_session");
    location.reload();
  },

  current(){
    return JSON.parse(localStorage.getItem("kerjadesa_session") || "null");
  }
};

window.KerjaDesaAuth = KerjaDesaAuth;
KerjaDesaAuth.init();
