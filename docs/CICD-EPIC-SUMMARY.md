# Ringkasan: Epic CICD — CI/CD & Deployment

## Batasan penting (mohon dibaca dulu)

Sandbox pengembangan yang saya pakai **tidak punya Docker, tidak bisa akses
internet ke luar domain tertentu, dan tidak punya server/domain sungguhan**.
Karena itu:

- **Yang saya BUAT & UJI semaksimal mungkin tanpa Docker**: `Dockerfile`,
  `docker-compose.yml` — sintaksnya divalidasi (YAML parse, review baris-per-
  baris), TAPI saya tidak bisa benar-benar `docker build`/`docker run` di
  sini untuk konfirmasi 100%.
- **Yang BENAR-BENAR saya uji jalan** (bukan cuma ditulis): script backup/
  restore database (dites end-to-end dgn data asli), konfigurasi Nginx
  (nginx sungguhan ter-install & `nginx -t` lolos), health check endpoint
  (dites kondisi DB nyala & mati), workflow GitHub Actions (YAML tervalidasi
  + environment variable-nya disimulasikan persis & migration/seed/test
  beneran dijalankan dgn kombinasi env var yang sama).
- **Yang secara inheren perlu infrastruktur nyata** (domain, server, akun
  pihak ketiga) — saya siapkan panduan langkah-demi-langkah yang konkret
  di `docs/DEPLOYMENT.md`, tapi eksekusi akhirnya perlu Anda lakukan sendiri
  dgn kredensial sungguhan.

## Status per ticket

| Ticket | Artifact | Status |
|---|---|---|
| CICD-01 Docker | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `docker/docker-entrypoint.sh` | Dibuat, YAML/sintaks divalidasi |
| CICD-02 CI (lint+test per PR) | `.github/workflows/ci.yml` | Dibuat, **environment variable-nya diverifikasi jalan** (migration+seed+265 test dijalankan lokal dgn kombinasi env persis yg dipakai workflow) |
| CICD-03 CD (deploy saat merge main) | `.github/workflows/deploy.yml` | Dibuat (test-gate → build image ke GHCR → SSH deploy + PM2 reload). Job deploy **sengaja OFF by default** sampai secret server diisi (lihat DEPLOYMENT.md §3) |
| CICD-04 Staging/production terpisah | `.env.staging.example`, `.env.production.example` + penjelasan di DEPLOYMENT.md §4 | Dibuat |
| CICD-05 PM2 + Nginx | `ecosystem.config.js`, `nginx/ems.conf` | Dibuat, **Nginx config diverifikasi lolos `nginx -t` sungguhan** |
| CICD-06 Backup database | `scripts/db-backup.sh`, `scripts/db-restore.sh` | Dibuat, **diuji end-to-end** (backup data asli → restore ke DB terpisah → data cocok) |
| CICD-07 Monitoring/alerting | Health check diperkuat + integrasi Sentry (`src/instrument.js`) | Dibuat & diuji |
| CICD-08 Domain & SSL | Panduan lengkap di DEPLOYMENT.md §6 + blok SSL di `nginx/ems.conf` | Panduan dibuat, tidak bisa dites tanpa domain sungguhan |

## Temuan & perbaikan selama proses (bukan cuma nulis config, tapi verifikasi nyata)

1. **Bug nyata di health check**: `Promise.race` dgn `setTimeout` yang
   TIDAK di-`clearTimeout()` — menyisakan timer nyangkut ~3 detik di setiap
   pemanggilan endpoint. Ketahuan karena Jest tiba-tiba tidak mau keluar
   bersih lagi (padahal sudah diperbaiki di Epic TEST) begitu saya
   memperkuat health check ini. Sudah diperbaiki + diverifikasi hilang.
2. **Konfigurasi `test` env di Sequelize CLI ternyata otomatis menambah
   suffix `_test`** ke `DB_NAME` — kalau `ci.yml` diisi `DB_NAME=ems_db_test`
   secara naif, aplikasi akan mencari database `ems_db_test_test` (tidak
   ada). Ketahuan lewat simulasi manual sebelum sempat jadi kegagalan CI
   yang membingungkan di GitHub sungguhan.
3. **Bug sintaks Dockerfile**: komentar `#` yang disisipkan DI TENGAH baris
   `RUN` multi-baris (dgn `\` continuation) ternyata memutus keseluruhan
   perintah shell (dibuktikan lewat tes langsung: menyebabkan syntax error
   `&& unexpected`) — diperbaiki dgn memindahkan komentar ke SEBELUM instruksi
   `RUN`, bukan di dalamnya.
4. **`http2 on;` (sintaks baru Nginx 1.25.1+) tidak dikenali** oleh Nginx
   1.24 (versi yang ter-install dari repo Ubuntu 24.04 sungguhan, saya
   install & tes langsung) — diganti ke sintaks lama `listen 443 ssl http2;`
   yang kompatibel jauh lebih luas.
5. **Cron `expireOrders` akan berjalan dobel di tiap instance PM2 cluster
   mode** kalau tidak dijaga — ditambahkan guard `NODE_APP_INSTANCE` di
   `src/server.js` supaya cuma jalan di satu instance.
6. **`sequelize-cli` (dibutuhkan untuk migration) adalah devDependency** —
   kalau image Docker production cuma `npm ci --omit=dev`, migration tidak
   akan bisa dijalankan dari image yang sama. Diatasi dgn stage Docker
   terpisah (`migrator`) khusus untuk ini, image `runtime` produksi tetap ramping.

## Yang WAJIB Anda lakukan sendiri (infrastruktur nyata)

Checklist lengkap & runtut ada di `docs/DEPLOYMENT.md` §9, ringkasnya: sewa
VPS, beli domain, isi secret GitHub Actions, generate secret production
sungguhan, jalankan Certbot, daftarkan webhook URL ke Xendit Dashboard, dan
opsional buat akun Sentry/UptimeRobot. Semuanya sudah dijelaskan
langkah-demi-langkah dengan perintah konkret yang tinggal disalin.
