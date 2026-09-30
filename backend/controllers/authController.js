// KerjaDesa Pro - Authentication Controller Foundation
// Tahap: API Authentication Multi User

const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'ADMIN',
    name: 'Administrator KerjaDesa'
  }
];

function login(username, password) {
  const user = users.find(
    (item) => item.username === username && item.password === password
  );

  if (!user) {
    return {
      success: false,
      message: 'Username atau password tidak sesuai'
    };
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    }
  };
}

module.exports = {
  login
};
