# HTTPS production

1. A record domain diarahkan ke IP VPS.
2. Set `KERJADESA_DOMAIN=domain-anda` di `.env`.
3. Pastikan port 80 dan 443 terbuka pada firewall/security group.
4. Jalankan `docker compose up -d --build`.
5. Caddy akan meminta dan memperbarui sertifikat TLS secara otomatis.

Caddy menyimpan sertifikat pada volume Docker `caddy_data`.
