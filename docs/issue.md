# ✅ Issue Tracker — Event Management System

Backlog lengkap dari **setup proyek** hingga **production-ready**. Gunakan sebagai acuan pembuatan issue di GitHub/Jira — setiap baris dapat langsung disalin menjadi satu issue. Urutan Epic mengikuti urutan pengerjaan pada [`roadmap.md`](./roadmap.md).

**Legend ID**: `SETUP` Setup · `DB` Database · `AUTH` Auth & RBAC · `CAT` Kategori · `EVT` Event · `ORD` Order · `PAY` Payment/Xendit · `TIX` Ticket · `DASH` Dashboard/Report · `USR` User Mgmt · `NOTIF` Notifikasi · `SEARCH` Search & Filter · `SEC` Security · `TEST` Testing · `CICD` CI/CD & Deployment · `DOC` Docs & Launch

Checklist: `[ ]` belum dikerjakan · `[x]` selesai.

---

## Epic: SETUP — Project Setup & Foundation

- [ ] **SETUP-01** — Inisialisasi Git repository & branching strategy (`main` / `develop` / `feature/*`)
- [ ] **SETUP-02** — Inisialisasi Node.js project & install dependencies inti (`express`, `sequelize`, `mysql2`, `ejs`, `dotenv`)
- [ ] **SETUP-03** — Setup struktur folder (`config`, `models`, `controllers`, `services`, `routes`, `middlewares`, `views`, `utils`)
- [ ] **SETUP-04** — Setup `.env` / `.env.example` & config loader terpusat
- [ ] **SETUP-05** — Setup ESLint + Prettier + EditorConfig
- [ ] **SETUP-06** — Setup centralized logger (Winston + daily rotate)
- [ ] **SETUP-07** — Setup global error handling middleware & custom error classes (`AppError`, `NotFoundError`, dst.)
- [ ] **SETUP-08** — Setup standardized API response helper (envelope sukses/error)
- [ ] **SETUP-09** — Setup base layout EJS & partials (header, footer, navbar, flash message)

## Epic: DB — Database Design & Models

- [ ] **DB-01** — Setup konfigurasi Sequelize CLI (`config/database.js`, `.sequelizerc`) untuk env dev/test/prod
- [ ] **DB-02** — Migration & model: `users` (dengan enum `role`)
- [ ] **DB-03** — Migration & model: `categories`
- [ ] **DB-04** — Migration & model: `events` (FK ke `users`, `categories`; auto-generate `slug`)
- [ ] **DB-05** — Migration & model: `event_attachments`
- [ ] **DB-06** — Migration & model: `orders`
- [ ] **DB-07** — Migration & model: `payments` (relasi 1:1 ke `orders`)
- [ ] **DB-08** — Migration & model: `tickets`
- [ ] **DB-09** — Definisikan asosiasi Sequelize (`hasMany`/`belongsTo`) sesuai ERD
- [ ] **DB-10** — Seeder: admin default, beberapa kategori default
- [ ] **DB-11** — Tambahkan index performa: `events.slug`, `orders.order_number`, `tickets.ticket_code`, kombinasi `events.status + event_date`

## Epic: AUTH — Authentication & Authorization

- [ ] **AUTH-01** — `POST /auth/register` — registrasi customer (validasi email unik, hash password bcrypt)
- [ ] **AUTH-02** — `POST /auth/login` — generate JWT, set httpOnly cookie
- [ ] **AUTH-03** — `POST /auth/logout` — hapus cookie token
- [ ] **AUTH-04** — `POST /auth/forgot-password` — generate token reset & kirim email
- [ ] **AUTH-05** — `POST /auth/reset-password` — set password baru via token
- [ ] **AUTH-06** — `PATCH /auth/profile` — update profil (nama, phone, avatar)
- [ ] **AUTH-07** — `PATCH /auth/change-password` — ganti password (verifikasi password lama)
- [ ] **AUTH-08** — Middleware `authenticate` — verifikasi JWT dari cookie/header
- [ ] **AUTH-09** — Middleware `authorize(...roles)` — RBAC per route
- [ ] **AUTH-10** — Rate limiting khusus endpoint `login` & `forgot-password` (anti brute-force)

## Epic: CAT — Category Management

- [ ] **CAT-01** — `GET /categories` — list kategori (publik)
- [ ] **CAT-02** — `POST /categories` — buat kategori (admin)
- [ ] **CAT-03** — `PUT /categories/:id` — edit kategori (admin)
- [ ] **CAT-04** — `DELETE /categories/:id` — hapus kategori, guard bila masih dipakai event (admin)
- [ ] **CAT-05** — Validasi input kategori (nama wajib & unik)

## Epic: EVT — Event Management

- [ ] **EVT-01** — `POST /events` — buat event + auto-generate `slug` (organizer/admin)
- [ ] **EVT-02** — `PUT /events/:id` — edit event, cek kepemilikan (organizer/admin)
- [ ] **EVT-03** — `DELETE /events/:id` — hapus event
- [ ] **EVT-04** — `PATCH /events/:id/publish` — `draft` → `published`
- [ ] **EVT-05** — `PATCH /events/:id/unpublish` — `published` → `draft`/`closed`
- [ ] **EVT-06** — Upload banner event (Multer + validasi tipe/ukuran file)
- [ ] **EVT-07** — `POST /events/:id/attachments` — upload lampiran event
- [ ] **EVT-08** — `DELETE /attachments/:id` — hapus lampiran
- [ ] **EVT-09** — `GET /events` — list publik dengan pagination
- [ ] **EVT-10** — `GET /events/:slug` — detail event publik
- [ ] **EVT-11** — Search & filter event (nama, kategori, tanggal, lokasi, harga)
- [ ] **EVT-12** — `GET /organizer/events/:id/statistics` — statistik per event

## Epic: ORD — Order & Ticket Purchase Flow

- [ ] **ORD-01** — `POST /orders` — buat order + validasi kuota tersedia
- [ ] **ORD-02** — Generator `order_number` unik (format `ORD-YYYYMMDD-XXXXXX`)
- [ ] **ORD-03** — Kalkulasi otomatis `subtotal`, `service_fee`, `total_amount`
- [ ] **ORD-04** — Transaction + row locking saat mengurangi `available_ticket` (cegah race condition)
- [ ] **ORD-05** — `GET /orders` — riwayat order milik user
- [ ] **ORD-06** — `GET /orders/:id` — detail order
- [ ] **ORD-07** — `PATCH /orders/:id/cancel` — batalkan order `pending`, kembalikan kuota
- [ ] **ORD-08** — Cron job auto-expire order `pending` yang melewati `ORDER_EXPIRY_MINUTES`

## Epic: PAY — Xendit Payment Integration & Webhook

- [ ] **PAY-01** — Setup konfigurasi client Xendit (`XENDIT_SECRET_KEY`) via environment
- [ ] **PAY-02** — Service `xendit.service.js` — create invoice (`POST /v2/invoices`) saat order dibuat
- [ ] **PAY-03** — Simpan response invoice ke tabel `payments` (`invoice_id`, `external_id`, `payment_url`, `expired_at`)
- [ ] **PAY-04** — `GET /orders/:id/payment` — ambil `payment_url` untuk redirect customer
- [ ] **PAY-05** — `POST /api/webhooks/xendit` — endpoint penerima callback
- [ ] **PAY-06** — Verifikasi webhook via header `x-callback-token` (constant-time compare)
- [ ] **PAY-07** — Handle status `PAID`/`SETTLED` → update `payments`/`orders`, generate tiket
- [ ] **PAY-08** — Handle status `EXPIRED`/gagal → update status, kembalikan kuota, **tidak** generate tiket
- [ ] **PAY-09** — Idempotency handling webhook (cegah proses ganda saat Xendit retry)
- [ ] **PAY-10** — `GET /orders/:id/payment-status` — polling status dari sisi frontend
- [ ] **PAY-11** — Logging seluruh request/response ke Xendit untuk audit rekonsiliasi

## Epic: TIX — Ticket Management & Check-in

- [ ] **TIX-01** — Generator `ticket_code` unik per tiket
- [ ] **TIX-02** — Generate QR Code (`qrcode`) meng-encode `ticket_code`
- [ ] **TIX-03** — `GET /tickets/:id` — detail tiket + tampilan QR
- [ ] **TIX-04** — `GET /tickets/:id/download` — generate & unduh e-ticket PDF
- [ ] **TIX-05** — `POST /tickets/scan` — organizer scan QR tiket
- [ ] **TIX-06** — Validasi tiket saat scan (event milik organizer, tiket valid)
- [ ] **TIX-07** — Cegah duplicate check-in (`409` bila `is_checked_in = true`)

## Epic: DASH — Dashboard & Reports

- [ ] **DASH-01** — `GET /organizer/dashboard` — total event, tiket terjual, revenue, visitor, event mendatang
- [ ] **DASH-02** — `GET /admin/dashboard` — total user/organizer/customer/event/order/revenue platform
- [ ] **DASH-03** — `GET /organizer/reports/sales` — laporan penjualan
- [ ] **DASH-04** — `GET /organizer/reports/event-performance` — performa per event
- [ ] **DASH-05** — `GET /admin/reports/revenue` — revenue platform
- [ ] **DASH-06** — `GET /admin/reports/users` — laporan user
- [ ] **DASH-07** — `GET /admin/reports/payments` — laporan pembayaran
- [ ] **DASH-08** — Optimasi query dashboard (aggregation & index; caching bila diperlukan)

## Epic: USR — User Management (Admin)

- [ ] **USR-01** — `GET /admin/users` — list user + pagination + search
- [ ] **USR-02** — `POST /admin/users` — buat user (role apa pun)
- [ ] **USR-03** — `PUT /admin/users/:id` — edit user
- [ ] **USR-04** — `DELETE /admin/users/:id` — hapus user
- [ ] **USR-05** — `PATCH /admin/users/:id/role` — ubah role user
- [ ] **USR-06** — `PATCH /admin/users/:id/suspend` — suspend/aktifkan user

## Epic: NOTIF — Notifications

- [ ] **NOTIF-01** — Setup email service (Nodemailer) + template EJS untuk email
- [ ] **NOTIF-02** — Notifikasi: registrasi berhasil
- [ ] **NOTIF-03** — Notifikasi: payment success / failed / expired
- [ ] **NOTIF-04** — Notifikasi: event updated / cancelled (ke pemegang tiket)
- [ ] **NOTIF-05** — Notifikasi internal ke admin (organizer baru, event baru, payment issue, system alert)

## Epic: SEARCH — Search & Filter

- [ ] **SEARCH-01** — Pencarian & filter order/tiket milik organizer
- [ ] **SEARCH-02** — Pencarian lintas entitas untuk admin (users, events, orders, payments)

## Epic: SEC — Security Hardening

- [ ] **SEC-01** — Setup `helmet` (security headers, CSP)
- [ ] **SEC-02** — Setup `cors` dengan whitelist origin
- [ ] **SEC-03** — Rate limiting (`express-rate-limit`) pada endpoint sensitif (login, forgot-password, webhook)
- [ ] **SEC-04** — Validasi & sanitasi input di seluruh endpoint (`express-validator`/Joi)
- [ ] **SEC-05** — Proteksi XSS (auto-escaping EJS, CSP via helmet)
- [ ] **SEC-06** — Proteksi CSRF pada form EJS (`csurf`/double-submit token)
- [ ] **SEC-07** — Audit proteksi SQL Injection (pastikan semua akses data lewat Sequelize, tanpa raw query dari input user)
- [ ] **SEC-08** — Review kekuatan hashing password (bcrypt salt rounds) & `JWT_SECRET`
- [ ] **SEC-09** — Security checklist pra-produksi (`npm audit`, dependency review)

## Epic: TEST — Testing

- [ ] **TEST-01** — Setup testing framework (Jest + Supertest)
- [ ] **TEST-02** — Unit test service layer (order, payment, ticket)
- [ ] **TEST-03** — Integration test endpoint auth
- [ ] **TEST-04** — Integration test endpoint event & order
- [ ] **TEST-05** — Test webhook Xendit dengan mock payload (verifikasi update status & idempotency)
- [ ] **TEST-06** — Setup laporan test coverage & ambang batas minimum

## Epic: CICD — CI/CD & Deployment

- [ ] **CICD-01** — Dockerize aplikasi (`Dockerfile` + `docker-compose` untuk app + MySQL)
- [ ] **CICD-02** — GitHub Actions: lint & test otomatis di setiap Pull Request
- [ ] **CICD-03** — GitHub Actions: build & deploy otomatis saat merge ke `main`
- [ ] **CICD-04** — Setup environment staging & production (env vars & secrets terpisah)
- [ ] **CICD-05** — Setup process manager (PM2) & reverse proxy (Nginx)
- [ ] **CICD-06** — Setup strategi backup database
- [ ] **CICD-07** — Setup monitoring/alerting dasar (uptime check, error tracking)
- [ ] **CICD-08** — Setup domain & SSL (wajib HTTPS agar webhook Xendit production dapat diterima)

## Epic: DOC — Documentation & Launch

- [ ] **DOC-01** — Tulis dokumentasi API (Postman collection atau OpenAPI/Swagger)
- [ ] **DOC-02** — Finalisasi `readme.md` (panduan setup lengkap)
- [ ] **DOC-03** — Final QA / User Acceptance Testing sebelum launch
- [ ] **DOC-04** — Go-live ke production + smoke test (termasuk uji webhook production end-to-end)

---

## Ringkasan Progress

| Epic      | Jumlah Issue | Status           |
| --------- | ------------ | ---------------- |
| SETUP     | 9            | ⬜ Belum dimulai |
| DB        | 11           | ⬜ Belum dimulai |
| AUTH      | 10           | ⬜ Belum dimulai |
| CAT       | 5            | ⬜ Belum dimulai |
| EVT       | 12           | ⬜ Belum dimulai |
| ORD       | 8            | ⬜ Belum dimulai |
| PAY       | 11           | ⬜ Belum dimulai |
| TIX       | 7            | ⬜ Belum dimulai |
| DASH      | 8            | ⬜ Belum dimulai |
| USR       | 6            | ⬜ Belum dimulai |
| NOTIF     | 5            | ⬜ Belum dimulai |
| SEARCH    | 2            | ⬜ Belum dimulai |
| SEC       | 9            | ⬜ Belum dimulai |
| TEST      | 6            | ⬜ Belum dimulai |
| CICD      | 8            | ⬜ Belum dimulai |
| DOC       | 4            | ⬜ Belum dimulai |
| **Total** | **121**      | —                |

> Update kolom **Status** (`⬜ Belum dimulai` / `🟨 Dikerjakan` / `✅ Selesai`) seiring progres tim. Proyek dianggap **selesai** ketika seluruh 121 issue pada dokumen ini bercentang `[x]`.
