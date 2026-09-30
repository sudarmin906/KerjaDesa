-- KerjaDesa Pro Database Migration
-- Initial users table

CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY,
 nama_lengkap VARCHAR(150) NOT NULL,
 username VARCHAR(100) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role VARCHAR(30) NOT NULL,
 desa VARCHAR(150),
 status VARCHAR(20) DEFAULT 'aktif',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default roles:
-- ADMIN, PLD, PEMDES, OPERATOR
