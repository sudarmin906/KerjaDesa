// KerjaDesa Pro - User Management Controller

const users = [];

function getUsers(req, res) {
  res.json({ success: true, data: users });
}

function createUser(req, res) {
  const user = {
    id: Date.now(),
    nama: req.body.nama,
    username: req.body.username,
    role: req.body.role || 'PLD',
    desa: req.body.desa || null
  };

  users.push(user);
  res.json({ success: true, data: user });
}

function updateUser(req, res) {
  res.json({ success: true, message: 'User update endpoint ready' });
}

function deleteUser(req, res) {
  res.json({ success: true, message: 'User delete endpoint ready' });
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
