-- KerjaDesa Pro Database Foundation

CREATE TABLE users (
 id INTEGER PRIMARY KEY,
 nama_lengkap VARCHAR(100),
 username VARCHAR(50) UNIQUE,
 password_hash TEXT,
 role VARCHAR(30),
 desa VARCHAR(100),
 status VARCHAR(20)
);

CREATE TABLE desa (
 id INTEGER PRIMARY KEY,
 nama_desa VARCHAR(100),
 kecamatan VARCHAR(100),
 kabupaten VARCHAR(100)
);

CREATE TABLE kegiatan (
 id INTEGER PRIMARY KEY,
 user_id INTEGER,
 desa_id INTEGER,
 judul VARCHAR(200),
 uraian TEXT,
 tanggal DATE
);

CREATE TABLE monitoring (
 id INTEGER PRIMARY KEY,
 kegiatan_id INTEGER,
 progres INTEGER,
 koordinat TEXT,
 foto TEXT,
 catatan TEXT
);

CREATE TABLE laporan (
 id INTEGER PRIMARY KEY,
 user_id INTEGER,
 bulan INTEGER,
 tahun INTEGER,
 isi TEXT
);
