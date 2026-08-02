#!/usr/bin/env bash
# scripts/db-backup.sh — CICD-06
#
# Dump database ke file terkompresi, hapus backup lokal yang lebih tua dari
# RETENTION_DAYS, dan (opsional) salin ke remote storage kalau RCLONE_REMOTE
# diisi (pakai `rclone` — mendukung S3, Backblaze B2, Google Drive, dst,
# tanpa perlu kode berbeda per provider).
#
# Pemakaian:
#   ./scripts/db-backup.sh                    # baca kredensial dari .env di root project
#   BACKUP_DIR=/data/backups ./scripts/db-backup.sh
#
# Setup terjadwal (cron, jalan tiap hari jam 2 pagi):
#   crontab -e
#   0 2 * * * /var/www/ems/scripts/db-backup.sh >> /var/log/ems-backup.log 2>&1
#
# (Systemd timer sbg alternatif cron ada di docs/DEPLOYMENT.md.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Baca .env project kalau ada (supaya tidak perlu duplikasi kredensial DB) —
# variabel yg SUDAH di-export di environment (mis. dari cron/systemd) tetap menang.
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="ems-db-${TIMESTAMP}.sql.gz"

: "${DB_HOST:?DB_HOST belum diisi (cek .env)}"
: "${DB_PORT:=3306}"
: "${DB_USER:?DB_USER belum diisi (cek .env)}"
: "${DB_PASSWORD:=}" # boleh kosong (mis. root tanpa password di dev lokal) — TIDAK boleh kosong di production, lihat SECURITY-CHECKLIST.md
: "${DB_NAME:?DB_NAME belum diisi (cek .env)}"

mkdir -p "$BACKUP_DIR"

echo "[db-backup] Dump $DB_NAME dari $DB_HOST:$DB_PORT -> $BACKUP_DIR/$FILENAME"

# --single-transaction: dump konsisten tanpa mengunci tabel (aman dijalankan
# saat aplikasi tetap melayani traffic, selama storage engine InnoDB — yang
# memang dipakai seluruh tabel migrasi proyek ini).
# --routines --triggers: ikutkan stored routine/trigger kalau ada di masa depan.
MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --quick \
  "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "[db-backup] Selesai. Ukuran: $BACKUP_SIZE"

# Rotasi: hapus backup lokal lebih tua dari RETENTION_DAYS
find "$BACKUP_DIR" -name 'ems-db-*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete | sed 's/^/[db-backup] Hapus (kadaluarsa): /'

# Salin ke remote (opsional) — butuh `rclone configure` sekali di server dulu,
# lihat docs/DEPLOYMENT.md. Off by default (aman kalau RCLONE_REMOTE kosong).
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    echo "[db-backup] Menyalin ke remote: $RCLONE_REMOTE"
    rclone copy "$BACKUP_DIR/$FILENAME" "$RCLONE_REMOTE"
  else
    echo "[db-backup] PERINGATAN: RCLONE_REMOTE diisi tapi 'rclone' tidak terpasang — backup TETAP tersimpan lokal, tapi tidak ter-copy off-site." >&2
  fi
fi

echo "[db-backup] Selesai semua."
