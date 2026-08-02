#!/bin/sh
# docker/docker-entrypoint.sh
#
# CICD-01: entrypoint tipis. Dua hal opsional (off by default) yang berguna
# terutama untuk docker-compose (satu instance) — BUKAN untuk deployment
# multi-replica di production (migrasi harus jadi langkah EKSPLISIT terpisah
# di pipeline deploy, lihat CICD-03 & docs/DEPLOYMENT.md, supaya beberapa
# instance tidak race menjalankan migration bersamaan).
set -e

# WAIT_FOR_DB=host:port — tunggu sampai TCP port DB kebuka sebelum lanjut.
# docker-compose "depends_on: condition: service_healthy" sudah menutupi ini
# untuk docker-compose sendiri; ini jaring pengaman tambahan (mis. kalau
# entrypoint ini dipakai di luar docker-compose, atau healthcheck DB lambat).
if [ -n "$WAIT_FOR_DB" ]; then
  host=$(echo "$WAIT_FOR_DB" | cut -d: -f1)
  port=$(echo "$WAIT_FOR_DB" | cut -d: -f2)
  echo "[entrypoint] Menunggu database $host:$port..."
  attempt=0
  until node -e "require('node:net').connect({host:'$host',port:$port}).on('connect',function(){process.exit(0)}).on('error',function(){process.exit(1)})" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "[entrypoint] Database $host:$port tidak kunjung siap setelah 30x percobaan, menyerah." >&2
      exit 1
    fi
    sleep 2
  done
  echo "[entrypoint] Database sudah bisa diakses."
fi

# RUN_MIGRATIONS_ON_BOOT=true — jalankan migration sebelum start app. Cocok
# utk docker-compose lokal/staging satu instance; JANGAN dipakai kalau app
# di-scale >1 replica sekaligus (lihat catatan di atas).
if [ "$RUN_MIGRATIONS_ON_BOOT" = "true" ]; then
  echo "[entrypoint] Menjalankan migration..."
  npx sequelize-cli db:migrate
fi

exec "$@"
