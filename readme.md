# 🎫 Event Management System (EMS)

Backend API untuk platform manajemen event & ticketing online. Mendukung pembuatan event oleh organizer, penjualan tiket ke customer, serta pembayaran otomatis melalui **Xendit** (Virtual Account, E-Wallet, Kartu Kredit, QRIS) dengan sinkronisasi status pembayaran secara real-time via **Webhook**.

Dokumen ini adalah entry point proyek. Untuk detail lebih dalam, lihat folder [`docs/`](./docs).

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Tech Stack](#️-tech-stack)
- [Struktur Proyek](#-struktur-proyek)
- [Persyaratan Sistem](#-persyaratan-sistem)
- [Instalasi & Setup](#-instalasi--setup)
- [Environment Variables](#-environment-variables)
- [Setup Database](#-setup-database)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [Setup Webhook Xendit (Lokal)](#-setup-webhook-xendit-lokal)
- [Dokumentasi Lengkap](#-dokumentasi-lengkap)
- [Ringkasan API](#-ringkasan-api)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Kontribusi](#-kontribusi)
- [Lisensi](#-lisensi)

---

## ✨ Fitur Utama

| Modul | Deskripsi Singkat |
|---|---|
| **Auth & RBAC** | Register, login, JWT (httpOnly cookie), role `customer` / `organizer` / `admin` |
| **Event Management** | CRUD event, publish/unpublish, upload banner & attachment, kategori |
| **Ticket Ordering** | Validasi kuota real-time, kalkulasi total otomatis, auto-expire order pending |
| **Payment (Xendit)** | Invoice API (VA, E-Wallet, Kartu Kredit, QRIS) + Webhook callback otomatis |
| **E-Ticket** | Generate ticket code & QR Code, download PDF, scan & check-in anti-duplikat |
| **Dashboard & Report** | Dashboard Organizer & Admin, laporan penjualan/revenue |
| **Notifikasi** | Email notifikasi untuk order, payment, dan event lifecycle |
| **Security** | Rate limiting, CORS, CSRF, XSS/SQLi protection, input validation |

Rincian lengkap ada di [`docs/prd.md`](./docs/prd.md) dan [`docs/specification.md`](./docs/specification.md).

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js ≥ 18.x |
| Web Framework | Express.js |
| View Engine | EJS (dashboard & halaman publik) |
| Database | MySQL 8.x |
| ORM | Sequelize + sequelize-cli |
| Payment Gateway | Xendit — Invoice API & Webhook |
| Autentikasi | JWT (jsonwebtoken) via httpOnly cookie |
| Validasi | express-validator / Joi |
| Upload File | Multer |
| QR Code | `qrcode` |
| PDF E-Ticket | `pdfkit` / `puppeteer` |
| Scheduler | `node-cron` (auto-expire order) |
| Logging | Winston + `winston-daily-rotate-file` |
| Security | Helmet, CORS, express-rate-limit, `csurf`, bcrypt |
| Testing | Jest + Supertest |

> Keputusan arsitektur & alasan pemilihan stack ada di [`docs/architecture.md`](./docs/architecture.md).

## 📁 Struktur Proyek

```
event-management-system/
├── docs/                        # Dokumentasi proyek
│   ├── architecture.md
│   ├── specification.md
│   ├── prd.md
│   ├── roadmap.md
│   └── issue.md
├── src/
│   ├── config/                  # db, xendit, logger, multer config
│   ├── models/                  # Sequelize models
│   ├── migrations/
│   ├── seeders/
│   ├── controllers/             # Web (EJS) & API (JSON) controllers
│   ├── services/                # Business logic (order, xendit, ticket, dst.)
│   ├── routes/
│   │   ├── api/v1/               # REST API (JSON)
│   │   └── web/                  # Route render EJS
│   ├── middlewares/              # auth, role, error, validate, rate-limit
│   ├── validations/              # schema validasi per entity
│   ├── jobs/                     # cron: expire order, reminder
│   ├── utils/                    # response helper, generator kode, dst.
│   ├── views/                    # EJS templates
│   ├── public/                   # asset statis & hasil upload
│   ├── app.js
│   └── server.js
├── tests/
├── .env.example
├── .sequelizerc
└── package.json
```

Penjelasan lengkap tiap layer ada di [`docs/architecture.md`](./docs/architecture.md#5-struktur-folder).

## 💻 Persyaratan Sistem

- Node.js `>= 18.x` & npm `>= 9.x`
- MySQL `>= 8.0`
- Akun [Xendit](https://dashboard.xendit.co) (mode **Test/Sandbox** sudah cukup untuk development) beserta **Secret Key** dan **Webhook Verification Token**
- (Opsional, untuk testing webhook lokal) [ngrok](https://ngrok.com) atau tunnel sejenis

## 🚀 Instalasi & Setup

```bash
# 1. Clone repository
git clone <repo-url> event-management-system
cd event-management-system

# 2. Install dependencies
npm install

# 3. Salin file environment
cp .env.example .env
# lalu isi nilai .env sesuai konfigurasi lokal (lihat tabel di bawah)
```

## 🔑 Environment Variables

| Variable | Contoh | Keterangan |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | Port aplikasi |
| `APP_URL` | `http://localhost:3000` | Base URL, dipakai untuk redirect & link email |
| `DB_HOST` | `127.0.0.1` | Host MySQL |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_NAME` | `ems_db` | Nama database |
| `DB_USER` | `root` | User MySQL |
| `DB_PASSWORD` | `secret` | Password MySQL |
| `JWT_SECRET` | `random-long-string` | Secret untuk sign JWT |
| `JWT_EXPIRES_IN` | `1d` | Masa berlaku token |
| `COOKIE_SECRET` | `random-long-string` | Secret untuk cookie signing |
| `ORDER_EXPIRY_MINUTES` | `60` | Batas waktu order `pending` sebelum auto-expired |
| `XENDIT_SECRET_KEY` | `xnd_development_...` | Secret key dari Xendit Dashboard |
| `XENDIT_CALLBACK_TOKEN` | `random-token` | Webhook Verification Token dari Xendit Dashboard |
| `XENDIT_SUCCESS_REDIRECT_URL` | `${APP_URL}/orders/success` | Redirect setelah bayar sukses |
| `XENDIT_FAILURE_REDIRECT_URL` | `${APP_URL}/orders/failed` | Redirect setelah bayar gagal |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` | — | Konfigurasi SMTP untuk notifikasi email |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Window rate limiting (ms) |
| `RATE_LIMIT_MAX` | `100` | Maksimum request per window per IP |

Referensi lengkap & rasionalnya ada di [`docs/specification.md`](./docs/specification.md#9-environment-variables-reference).

## 🗄️ Setup Database

```bash
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Skema lengkap (7 tabel: `users`, `categories`, `events`, `event_attachments`, `orders`, `payments`, `tickets`) & ERD ada di [`docs/specification.md`](./docs/specification.md#2-skema-database-detail).

## ▶️ Menjalankan Aplikasi

```bash
# Development (dengan auto-reload, misal via nodemon)
npm run dev

# Production
npm start
```

Aplikasi berjalan di `http://localhost:3000` (web + API). Endpoint API berada di bawah prefix `/api/v1`.

## 🌐 Setup Webhook Xendit (Lokal)

Xendit membutuhkan URL publik untuk mengirim webhook. Untuk development lokal:

```bash
ngrok http 3000
```

Lalu daftarkan `https://<subdomain>.ngrok-free.app/api/webhooks/xendit` sebagai **Webhook URL** di Xendit Dashboard → *Settings → Webhooks*, dan salin **Verification Token** ke `XENDIT_CALLBACK_TOKEN` di `.env`.

## 📖 Dokumentasi Lengkap

| Dokumen | Isi |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | Arsitektur sistem, diagram, folder structure, alur payment |
| [`docs/specification.md`](./docs/specification.md) | Skema database, spesifikasi API, business rules, integrasi Xendit |
| [`docs/prd.md`](./docs/prd.md) | Product Requirements Document — tujuan produk, user stories, ruang lingkup |
| [`docs/roadmap.md`](./docs/roadmap.md) | Timeline & fase pengembangan dari nol hingga launch |
| [`docs/issue.md`](./docs/issue.md) | Backlog/issue tracker lengkap dari setup sampai proyek selesai |

## 🔌 Ringkasan API

Base path: `/api/v1`

| Grup | Contoh Endpoint |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password` |
| Events | `GET /events`, `GET /events/:slug`, `POST /events` |
| Orders | `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` |
| Payments | `GET /orders/:id/payment`, `POST /webhooks/xendit` |
| Tickets | `GET /tickets/:id`, `POST /tickets/scan` |
| Dashboard | `GET /organizer/dashboard`, `GET /admin/dashboard` |

Spesifikasi lengkap (request/response, auth, role) ada di [`docs/specification.md`](./docs/specification.md#4-spesifikasi-api-endpoint).

## 🧪 Testing

```bash
npm test              # jalankan seluruh test
npm run test:coverage # dengan laporan coverage
```

## 🚢 Deployment

Ringkasan singkat — detail lengkap di [`docs/architecture.md`](./docs/architecture.md#15-arsitektur-deployment):

1. Build image / siapkan server (Nginx + PM2 + MySQL).
2. Set seluruh environment variable **production**, termasuk `XENDIT_SECRET_KEY` & `XENDIT_CALLBACK_TOKEN` versi live.
3. Pastikan domain sudah memiliki **HTTPS aktif** — Xendit **mewajibkan** webhook URL berupa HTTPS.
4. Jalankan migrasi database di server: `npx sequelize-cli db:migrate`.
5. Daftarkan webhook URL production di Xendit Dashboard.

## 🤝 Kontribusi

1. Fork & buat branch dari `develop`: `feature/nama-fitur`.
2. Pastikan lint & test lulus sebelum membuka Pull Request.
3. Ikuti daftar task di [`docs/issue.md`](./docs/issue.md) sebagai acuan backlog.

## 📄 Lisensi

MIT License.
