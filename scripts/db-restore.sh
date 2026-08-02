#!/usr/bin/env bash
# scripts/db-restore.sh — CICD-06
#
# Pemakaian:
#   ./scripts/db-restore.sh backups/ems-db-20260115-020000.sql.gz
#
# PERINGATAN: script ini MENIMPA seluruh isi database tujuan (DB_NAME di
# .env). Selalu jalankan dulu latihan restore ke database SEMENTARA/staging
# sebelum benar-benar butuh dipakai saat insiden sungguhan — backup yang
# tidak pernah dicoba di-restore sama saja tidak ada.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-${DB_NAME:-}}" # argumen ke-2 opsional: restore ke DB lain drpd DB_NAME di .env (mis. utk latihan restore ke DB scratch)
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Pemakaian: $0 <path-ke-file-backup.sql.gz> [nama-database-tujuan]" >&2
  exit 1
fi

: "${DB_HOST:?DB_HOST belum diisi (cek .env)}"
: "${DB_PORT:=3306}"
: "${DB_USER:?DB_USER belum diisi (cek .env)}"
: "${DB_PASSWORD:=}"
: "${TARGET_DB:?Nama database tujuan belum diisi (DB_NAME kosong di .env & argumen ke-2 tidak diisi)}"

echo "!!! Ini akan MENIMPA seluruh isi database '$TARGET_DB' di $DB_HOST dengan isi $BACKUP_FILE"
read -r -p "Ketik nama database ('$TARGET_DB') untuk konfirmasi: " CONFIRM
if [ "$CONFIRM" != "$TARGET_DB" ]; then
  echo "Dibatalkan (input tidak cocok)." >&2
  exit 1
fi

echo "[db-restore] Memulihkan $BACKUP_FILE -> $TARGET_DB..."
gunzip -c "$BACKUP_FILE" | MYSQL_PWD="$DB_PASSWORD" mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  "$TARGET_DB"

echo "[db-restore] Selesai. Sebaiknya jalankan smoke test dasar (login, lihat daftar event) sebelum mengarahkan traffic production ke sini."
