// Compatibility wrapper for the active server-backed authentication module.
// The previous in-memory/plaintext implementation is retired.

const { login } = require('./apiController');

module.exports = { login };
