-- KerjaDesa Pro relational schema
-- Target: PostgreSQL 14+
-- JSON store remains the zero-dependency local fallback.

CREATE TABLE IF NOT EXISTS desa (
  id BIGSERIAL PRIMARY KEY,
  nama_desa VARCHAR(150) NOT NULL,
  kecamatan VARCHAR(150),
  kabupaten VARCHAR(150),
  provinsi VARCHAR(150),
  kode_desa VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  nama_lengkap VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN','PLD','PEMDES','OPERATOR')),
  desa_id BIGINT REFERENCES desa(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kegiatan (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  desa_id BIGINT REFERENCES desa(id) ON DELETE SET NULL,
  judul VARCHAR(200) NOT NULL,
  uraian TEXT,
  tanggal DATE,
  status VARCHAR(30) DEFAULT 'RENCANA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring (
  id BIGSERIAL PRIMARY KEY,
  kegiatan_id BIGINT REFERENCES kegiatan(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  progres INTEGER NOT NULL DEFAULT 0 CHECK (progres BETWEEN 0 AND 100),
  koordinat TEXT,
  foto TEXT,
  catatan TEXT,
  tanggal DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dokumen (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  desa_id BIGINT REFERENCES desa(id) ON DELETE SET NULL,
  nama_file VARCHAR(255) NOT NULL,
  kategori VARCHAR(80),
  mime_type VARCHAR(120),
  storage_path TEXT,
  ukuran BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laporan (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  desa_id BIGINT REFERENCES desa(id) ON DELETE SET NULL,
  bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INTEGER NOT NULL,
  isi TEXT,
  status VARCHAR(30) DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_desa ON kegiatan(desa_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_kegiatan ON monitoring(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_desa ON dokumen(desa_id);
CREATE INDEX IF NOT EXISTS idx_laporan_periode ON laporan(tahun, bulan);


-- Server-side opaque authentication sessions.
-- Only a SHA-256 token fingerprint is stored; the raw session token remains in
-- the Secure/HttpOnly browser cookie.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
