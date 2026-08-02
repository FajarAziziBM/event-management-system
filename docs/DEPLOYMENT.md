# Deployment Guide — Event Management System

Panduan lengkap deploy aplikasi ini ke server sungguhan: dari kosong (VPS baru)
sampai bisa diakses publik lewat domain dengan HTTPS. Setiap bagian merujuk ke
ticket Epic CICD yang relevan.

> **Asumsi lingkungan**: satu VPS Linux (Ubuntu 22.04/24.04) untuk production,
> opsional satu lagi untuk staging. Kalau pakai provider terkelola (Railway,
> Render, dst), sebagian langkah (Nginx, SSL, PM2) sudah ditangani platform —
> lewati bagian yang tidak relevan.

## Daftar Isi
1. [Arsitektur ringkas](#1-arsitektur-ringkas)
2. [CICD-01 — Docker untuk dev lokal](#2-cicd-01--docker-untuk-dev-lokal)
3. [CICD-02/03 — GitHub Actions (CI/CD)](#3-cicd-0203--github-actions-cicd)
4. [CICD-04 — Staging vs Production](#4-cicd-04--staging-vs-production)
5. [CICD-05 — Setup server: Node, PM2, Nginx](#5-cicd-05--setup-server-node-pm2-nginx)
6. [CICD-08 — Domain & SSL](#6-cicd-08--domain--ssl)
7. [CICD-06 — Backup database](#7-cicd-06--backup-database)
8. [CICD-07 — Monitoring & alerting](#8-cicd-07--monitoring--alerting)
9. [Checklist go-live](#9-checklist-go-live)

---

## 1. Arsitektur ringkas

```
Internet ──HTTPS──▶ Nginx (443/80) ──HTTP──▶ PM2 (cluster, 127.0.0.1:3000) ──▶ MySQL
                       │                          │
                  Let's Encrypt              Winston logs + Sentry (opsional)
                  (auto-renew)                cron expireOrders (1 instance saja)
```

Docker **tidak** dipakai untuk production di sini — dipakai untuk CI (test
konsisten di GitHub Actions) dan kemudahan dev lokal (`docker compose up`).
Production jalan sbg proses Node biasa dikelola PM2, di belakang Nginx —
lebih ringan & lebih mudah di-debug utk aplikasi skala ini dibanding
menambah lapisan container di production juga. Lihat komentar di
`.github/workflows/deploy.yml` untuk alasan lebih lengkap.

## 2. CICD-01 — Docker untuk dev lokal

```bash
cp .env.example .env
docker compose up -d mysql
docker compose run --rm migrate
docker compose run --rm migrate npx sequelize-cli db:seed:all   # opsional
docker compose up -d app
curl http://localhost:3000/api/v1/health
```

`Dockerfile` multi-stage: `deps`/`deps-full` (install), `runtime` (image
final, ramping, non-root), `migrator` (image terpisah khusus migration,
butuh `sequelize-cli` yg cuma devDependency). Detail tiap keputusan ada
sbg komentar langsung di `Dockerfile` & `docker-compose.yml`.

## 3. CICD-02/03 — GitHub Actions (CI/CD)

`.github/workflows/ci.yml` jalan otomatis di tiap Pull Request (lint,
format check, migration+seed ke MySQL service container, test+coverage
dgn ambang batas dari `jest.config.js`). Tidak perlu setup apa pun di
GitHub Secrets untuk ini — semua kredensial di dalamnya cuma untuk
database sekali-pakai di dalam job CI itu sendiri.

`.github/workflows/deploy.yml` jalan tiap push ke `main`: re-test →
build+push image ke GHCR → deploy via SSH. **Job deploy dilewati (bukan
gagal)** sampai Anda:

1. Buat GitHub Environment bernama `production` (Settings → Environments)
2. Isi 4 secret di environment tsb:

   | Secret | Isi |
   |---|---|
   | `DEPLOY_HOST` | IP/hostname server production |
   | `DEPLOY_USER` | User SSH — **buat user khusus deploy, JANGAN root**: `adduser deploy && usermod -aG sudo deploy` |
   | `DEPLOY_SSH_KEY` | Private key (format PEM) dari pasangan key khusus deploy: `ssh-keygen -t ed25519 -f deploy_key -C "github-actions"`, lalu public key-nya (`deploy_key.pub`) ditaruh di `~deploy/.ssh/authorized_keys` server |
   | `DEPLOY_PATH` | Path absolut aplikasi di server, mis. `/var/www/ems` |

3. Set repository **variable** (bukan secret) `DEPLOY_ENABLED=true`
   (Settings → Variables) — baru setelah ini job deploy benar-benar aktif.

User `deploy` butuh izin sudo TANPA password khusus untuk `pm2` & baca/tulis
`DEPLOY_PATH` saja (bukan full sudo) — contoh `/etc/sudoers.d/deploy`:
```
deploy ALL=(ALL) NOPASSWD: /usr/bin/pm2
```

## 4. CICD-04 — Staging vs Production

**Prinsip kunci** (lihat juga komentar di `ecosystem.config.js`):
`src/config/env.js` cuma membedakan cabang kode `NODE_ENV=test` vs selainnya
— **tidak ada cabang kode khusus "staging"**. Jadi staging & production
sama-sama jalan dgn `NODE_ENV=production` (supaya staging dapat proteksi
setara production — cookie secure, penolakan secret lemah, dst). Yang
benar-benar memisahkan keduanya:

| Aspek | Staging | Production |
|---|---|---|
| Server/direktori | Terpisah (server lain ATAU direktori lain, mis. `/var/www/ems-staging`) | Terpisah |
| File `.env` | `.env.staging.example` → isi sendiri | `.env.production.example` → isi sendiri |
| Database | `ems_db_staging`, boleh dihapus/reset kapan saja | `ems_db`, backup rutin (CICD-06) |
| Xendit | **Selalu mode Test** (`xnd_development_...`) | Mode **Live** (`xnd_production_...`) |
| Domain | `staging.example.com` | `example.com` |
| PM2 app name | `ems-api` (di server berbeda, nama sama tidak masalah) | `ems-api` |

Copy `.env.staging.example`/`.env.production.example` ke `.env` di server
masing-masing, isi setiap placeholder dgn nilai sungguhan. **Jangan pernah**
salin isi `.env` production ke staging atau sebaliknya.

## 5. CICD-05 — Setup server: Node, PM2, Nginx

Di server (Ubuntu 22.04/24.04), sbg user `deploy`:

```bash
# Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL 8
sudo apt-get install -y mysql-server
sudo mysql_secure_installation

# PM2 (global)
sudo npm install -g pm2

# Clone & setup aplikasi
sudo mkdir -p /var/www/ems && sudo chown deploy:deploy /var/www/ems
git clone <url-repo-anda> /var/www/ems
cd /var/www/ems
npm ci --omit=dev
cp .env.production.example .env    # lalu ISI setiap placeholder
npx sequelize-cli db:migrate --env production

# Start dgn PM2, cluster mode (lihat ecosystem.config.js)
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup    # ikuti instruksi yg ditampilkan (bikin PM2 auto-start saat reboot)
```

**Nginx** (reverse proxy di depan PM2):
```bash
sudo apt-get install -y nginx
sudo cp nginx/ems.conf /etc/nginx/sites-available/ems
# GANTI example.com -> domain asli di dalam file itu dulu
sudo ln -s /etc/nginx/sites-available/ems /etc/nginx/sites-enabled/ems
sudo rm -f /etc/nginx/sites-enabled/default   # kalau masih ada default Nginx
sudo nginx -t && sudo systemctl reload nginx
```

Nginx belum bisa langsung dipakai sebelum sertifikat SSL ada — lanjut ke
bagian 6 dulu sebelum `nginx -t` di atas akan benar-benar lolos (baris
`ssl_certificate` di `nginx/ems.conf` masih dikomentari sampai Certbot
mengisinya).

## 6. CICD-08 — Domain & SSL

**Kenapa ini wajib** (bukan opsional): Xendit **mewajibkan URL HTTPS** untuk
webhook production (`XENDIT_CALLBACK_URL` di Xendit Dashboard) — webhook
notifikasi pembayaran tidak akan terkirim ke URL `http://` biasa di mode
Live. Tanpa HTTPS, status pembayaran customer tidak akan pernah ter-update
otomatis di production.

1. **Beli domain** (registrar apa saja — Namecheap, Niagahoster, dll)
2. **Arahkan DNS** ke IP server: buat A record
   - `example.com` → IP server production
   - `www.example.com` → IP server production (atau CNAME ke `example.com`)
   - (staging, kalau ada) `staging.example.com` → IP server staging
   Tunggu propagasi (`dig example.com` sampai muncul IP yang benar, biasanya
   beberapa menit sampai 1 jam).
3. **Install Certbot & terbitkan sertifikat**:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d example.com -d www.example.com
   ```
   Certbot otomatis mengisi baris `ssl_certificate`/`ssl_certificate_key`
   di `nginx/ems.conf` yang sebelumnya dikomentari, dan reload Nginx sendiri.
4. **Verifikasi auto-renew** (sertifikat Let's Encrypt berlaku 90 hari):
   ```bash
   sudo certbot renew --dry-run
   ```
   Certbot di Ubuntu otomatis pasang systemd timer (`certbot.timer`) —
   cek dgn `systemctl list-timers | grep certbot`. Kalau tidak ada,
   tambahkan cron manual: `0 3 * * * certbot renew --quiet`.
5. **Update `.env` production**: `APP_URL`, `CORS_ALLOWED_ORIGINS`,
   `XENDIT_SUCCESS_REDIRECT_URL`, `XENDIT_FAILURE_REDIRECT_URL` ke
   `https://example.com/...`, lalu `pm2 reload ecosystem.config.js --env production`.
6. **Daftarkan webhook URL di Xendit Dashboard** (Settings → Webhooks):
   `https://example.com/api/webhooks/xendit`, mode **Live**.

## 7. CICD-06 — Backup database

```bash
chmod +x scripts/db-backup.sh scripts/db-restore.sh
./scripts/db-backup.sh    # tes manual dulu
```

Jadwalkan harian lewat cron:
```bash
crontab -e
# Backup tiap hari jam 2 pagi, simpan 14 hari terakhir (bisa diubah lewat BACKUP_RETENTION_DAYS)
0 2 * * * /var/www/ems/scripts/db-backup.sh >> /var/log/ems-backup.log 2>&1
```

Atau systemd timer (`/etc/systemd/system/ems-backup.timer` +
`ems-backup.service`) kalau prefer dibanding cron — fungsinya sama.

**Off-site copy** (sangat direkomendasikan — backup yang cuma ada di server
yang sama dgn database aslinya tidak melindungi dari kegagalan disk/server):
```bash
# Sekali saja, setup rclone ke provider pilihan (S3, Backblaze B2, dll)
rclone config
# Lalu tambahkan ke .env:
echo 'RCLONE_REMOTE=namaremote:nama-bucket/ems-backups' >> .env
```

**Latihan restore** (jangan tunggu insiden sungguhan untuk tahu backup-nya
valid): jadwalkan sekali sebulan, restore ke database scratch:
```bash
mysql -uroot -p -e "CREATE DATABASE ems_restore_drill;"
./scripts/db-restore.sh backups/ems-db-TERBARU.sql.gz ems_restore_drill
mysql -uroot -p ems_restore_drill -e "SELECT COUNT(*) FROM users;"   # harus masuk akal
mysql -uroot -p -e "DROP DATABASE ems_restore_drill;"
```

## 8. CICD-07 — Monitoring & alerting

**Uptime check** (gratis, 5 menit setup) — pilih salah satu:
- [UptimeRobot](https://uptimerobot.com): tambah monitor tipe HTTP(s),
  URL `https://example.com/api/v1/health`, interval 5 menit, alert via
  email/Telegram/Slack kalau status bukan 200.
- [Better Uptime](https://betteruptime.com) atau
  [Healthchecks.io](https://healthchecks.io): alternatif serupa.

Endpoint `/api/v1/health` sudah diperkuat (bukan cuma `return 200` statis)
— dia benar-benar cek koneksi database (`db.sequelize.authenticate()`,
timeout 3 detik) dan balas **503** kalau database tidak terjangkau, supaya
uptime monitor benar-benar mendeteksi masalah nyata, bukan cuma "proses
Node-nya hidup".

**Error tracking** (Sentry, opsional tapi direkomendasikan di production):
1. Buat akun & project baru di [sentry.io](https://sentry.io) (tier gratis
   cukup untuk mulai), pilih platform "Node.js" / "Express"
2. Copy DSN yang diberikan, isi ke `.env`: `SENTRY_DSN=https://...`
3. `pm2 reload ecosystem.config.js --env production`

Selesai — `src/instrument.js` otomatis aktif begitu `SENTRY_DSN` terisi
(tanpa DSN, kode ini sama sekali tidak melakukan apa pun, aman dibiarkan
kosong di dev/staging kalau belum perlu). Menangkap: error tak tertangani
di request HTTP manapun, `uncaughtException`, dan `unhandledRejection`
(lihat `src/server.js`).

**PM2 built-in monitoring** (gratis, sudah tersedia tanpa setup tambahan):
```bash
pm2 monit        # CPU/memory real-time tiap instance
pm2 logs         # tail log semua instance
pm2 status       # ringkasan status
```

## 9. Checklist go-live

- [ ] `.env` production sudah diisi lengkap, TIDAK ada nilai contoh/placeholder tersisa (app akan menolak start kalau JWT/Cookie/CSRF secret masih placeholder — lihat SECURITY-CHECKLIST.md)
- [ ] `COOKIE_SECURE=true`, `TRUST_PROXY=1`
- [ ] Domain sudah live dgn HTTPS (`curl -I https://example.com` → 200, bukan certificate warning)
- [ ] Webhook Xendit terdaftar ke URL production, mode Live
- [ ] `pm2 status` menunjukkan seluruh instance `online`, bukan `errored`/`stopped`
- [ ] `curl https://example.com/api/v1/health` → 200, `"database":"connected"`
- [ ] Backup pertama sudah jalan manual & berhasil di-restore ke DB scratch (langkah 7)
- [ ] Uptime monitor sudah aktif & sudah dites (matikan app sebentar, pastikan alert benar-benar masuk)
- [ ] GitHub Actions `deploy.yml` sudah dites sekali dgn perubahan kecil tidak berbahaya (mis. update komentar), pastikan deploy otomatis benar-benar sampai ke server
