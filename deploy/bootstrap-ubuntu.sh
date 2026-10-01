#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kerjadesa}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER" || true

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER":"$USER" "$APP_DIR"
  git clone https://github.com/sudarmin906/KerjaDesa.git "$APP_DIR"
fi

echo "Server dasar siap di $APP_DIR"
echo "Buat $APP_DIR/.env dari .env.production.example sebelum menjalankan Compose."
