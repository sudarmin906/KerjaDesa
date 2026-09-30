// KerjaDesa Pro - Database Connector Foundation
// Placeholder konfigurasi database online.
// Akan dihubungkan ke PostgreSQL/MySQL pada tahap deployment backend.

const databaseConfig = {
  driver: 'postgresql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'kerjadesa_pro',
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || ''
};

module.exports = databaseConfig;
