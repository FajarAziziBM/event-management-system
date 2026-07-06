# 📐 Technical Specification — Event Management System

Dokumen ini adalah rujukan teknis detail: skema database, spesifikasi API, aturan bisnis, dan integrasi Xendit. Untuk gambaran arsitektur high-level, lihat [`architecture.md`](./architecture.md).

---

## 1. Tech Stack Detail

| Kebutuhan             | Library/Tool                                     |
| --------------------- | ------------------------------------------------ |
| Web framework         | `express`                                        |
| View engine           | `ejs`, `express-ejs-layouts`                     |
| Database driver       | `mysql2`                                         |
| ORM                   | `sequelize`, `sequelize-cli`                     |
| Auth                  | `jsonwebtoken`, `bcrypt`, `cookie-parser`        |
| Validasi              | `express-validator` (atau `joi`)                 |
| Upload                | `multer`                                         |
| QR Code               | `qrcode`                                         |
| PDF                   | `pdfkit`                                         |
| HTTP client ke Xendit | `axios` (atau `xendit-node` SDK resmi)           |
| Scheduler             | `node-cron`                                      |
| Logging               | `winston`, `winston-daily-rotate-file`, `morgan` |
| Security              | `helmet`, `cors`, `express-rate-limit`, `csurf`  |
| Email                 | `nodemailer`                                     |
| Testing               | `jest`, `supertest`                              |

---

## 2. Skema Database (Detail)

### 2.1 `users`

| Field                   | Tipe                                 | Constraint                   |
| ----------------------- | ------------------------------------ | ---------------------------- |
| id                      | bigint                               | PK, AUTO_INCREMENT           |
| name                    | varchar(255)                         | NOT NULL                     |
| email                   | varchar(255)                         | UNIQUE, NOT NULL             |
| password                | varchar(255)                         | NOT NULL (hashed, bcrypt)    |
| phone                   | varchar(20)                          | NULL                         |
| role                    | enum('admin','organizer','customer') | NOT NULL, default `customer` |
| avatar                  | varchar(255)                         | NULL                         |
| created_at / updated_at | timestamp                            |                              |

### 2.2 `categories`

| Field                   | Tipe         | Constraint       |
| ----------------------- | ------------ | ---------------- |
| id                      | bigint       | PK               |
| name                    | varchar(100) | NOT NULL, UNIQUE |
| description             | text         | NULL             |
| icon                    | varchar(255) | NULL             |
| created_at / updated_at | timestamp    |                  |

### 2.3 `events`

| Field                       | Tipe                                           | Constraint                                  |
| --------------------------- | ---------------------------------------------- | ------------------------------------------- |
| id                          | bigint                                         | PK                                          |
| creator_id                  | bigint                                         | FK → `users.id`                             |
| category_id                 | bigint                                         | FK → `categories.id`                        |
| title                       | varchar(255)                                   | NOT NULL                                    |
| slug                        | varchar(255)                                   | UNIQUE, NOT NULL (auto-generate dari title) |
| description                 | text                                           |                                             |
| image_path                  | varchar(255)                                   |                                             |
| venue                       | varchar(255)                                   |                                             |
| address                     | text                                           |                                             |
| latitude / longitude        | decimal(10,7)                                  | NULL                                        |
| event_date / event_end_date | datetime                                       | NOT NULL                                    |
| max_attendees               | integer                                        | NOT NULL                                    |
| ticket_price                | decimal(12,2)                                  | NOT NULL                                    |
| available_ticket            | integer                                        | NOT NULL (di-maintain sebagai counter)      |
| status                      | enum('draft','published','closed','cancelled') | default `draft`                             |
| created_at / updated_at     | timestamp                                      |                                             |

### 2.4 `event_attachments`

| Field      | Tipe         | Constraint       |
| ---------- | ------------ | ---------------- |
| id         | bigint       | PK               |
| event_id   | bigint       | FK → `events.id` |
| file_name  | varchar(255) |                  |
| file_path  | varchar(255) |                  |
| file_type  | varchar(50)  |                  |
| created_at | timestamp    |                  |

### 2.5 `orders`

| Field                   | Tipe                                                    | Constraint        |
| ----------------------- | ------------------------------------------------------- | ----------------- |
| id                      | bigint                                                  | PK                |
| order_number            | varchar(50)                                             | UNIQUE, NOT NULL  |
| user_id                 | bigint                                                  | FK → `users.id`   |
| event_id                | bigint                                                  | FK → `events.id`  |
| quantity                | integer                                                 | NOT NULL, min 1   |
| subtotal                | decimal(12,2)                                           | NOT NULL          |
| service_fee             | decimal(12,2)                                           | default 0         |
| total_amount            | decimal(12,2)                                           | NOT NULL          |
| payment_status          | enum('pending','paid','expired','cancelled','refunded') | default `pending` |
| payment_method          | varchar(50)                                             | NULL              |
| expired_at              | datetime                                                | NULL              |
| paid_at                 | datetime                                                | NULL              |
| created_at / updated_at | timestamp                                               |                   |

### 2.6 `payments`

| Field                   | Tipe                                      | Constraint                            |
| ----------------------- | ----------------------------------------- | ------------------------------------- |
| id                      | bigint                                    | PK                                    |
| order_id                | bigint                                    | FK → `orders.id`, UNIQUE (relasi 1:1) |
| provider                | varchar(50)                               | default `xendit`                      |
| invoice_id              | varchar(100)                              | Xendit invoice `id`                   |
| external_id             | varchar(100)                              | = `orders.order_number`               |
| payment_url             | text                                      | Xendit `invoice_url`                  |
| status                  | enum('pending','paid','expired','failed') | default `pending`                     |
| expired_at              | datetime                                  |                                       |
| paid_at                 | datetime                                  | NULL                                  |
| created_at / updated_at | timestamp                                 |                                       |

### 2.7 `tickets`

| Field                         | Tipe        | Constraint                         |
| ----------------------------- | ----------- | ---------------------------------- |
| id                            | bigint      | PK                                 |
| order_id                      | bigint      | FK → `orders.id`                   |
| event_id                      | bigint      | FK → `events.id`                   |
| ticket_code                   | varchar(50) | UNIQUE                             |
| qr_code                       | text        | data QR (base64/string ter-encode) |
| attendee_name / email / phone | varchar     | diisi dari data pemesan (default)  |
| is_checked_in                 | boolean     | default false                      |
| checked_in_at                 | datetime    | NULL                               |
| created_at                    | timestamp   |                                    |

### 2.8 Relasi Antar Tabel

| Parent     | Child             | Relasi |
| ---------- | ----------------- | ------ |
| users      | events            | 1—N    |
| categories | events            | 1—N    |
| users      | orders            | 1—N    |
| events     | orders            | 1—N    |
| orders     | payments          | 1—1    |
| orders     | tickets           | 1—N    |
| events     | tickets           | 1—N    |
| events     | event_attachments | 1—N    |

---

## 3. Spesifikasi API Endpoint

Base path: `/api/v1`. Kolom **Role** kosong = publik (tidak butuh login).

### 3.1 Auth

| Method | Endpoint                | Role  | Deskripsi                        |
| ------ | ----------------------- | ----- | -------------------------------- |
| POST   | `/auth/register`        | —     | Registrasi customer baru         |
| POST   | `/auth/login`           | —     | Login, set cookie JWT            |
| POST   | `/auth/logout`          | Semua | Hapus cookie JWT                 |
| POST   | `/auth/forgot-password` | —     | Kirim email token reset password |
| POST   | `/auth/reset-password`  | —     | Set password baru via token      |
| GET    | `/auth/me`              | Semua | Ambil profil user login          |
| PATCH  | `/auth/profile`         | Semua | Update profil                    |
| PATCH  | `/auth/change-password` | Semua | Ganti password                   |

### 3.2 Users (Admin)

| Method | Endpoint                   | Role  | Deskripsi                      |
| ------ | -------------------------- | ----- | ------------------------------ |
| GET    | `/admin/users`             | admin | List user (pagination, search) |
| POST   | `/admin/users`             | admin | Buat user baru (role apa pun)  |
| GET    | `/admin/users/:id`         | admin | Detail user                    |
| PUT    | `/admin/users/:id`         | admin | Edit user                      |
| DELETE | `/admin/users/:id`         | admin | Hapus user                     |
| PATCH  | `/admin/users/:id/role`    | admin | Ubah role user                 |
| PATCH  | `/admin/users/:id/suspend` | admin | Suspend/aktifkan user          |

### 3.3 Categories

| Method | Endpoint          | Role  | Deskripsi                                       |
| ------ | ----------------- | ----- | ----------------------------------------------- |
| GET    | `/categories`     | —     | List kategori                                   |
| POST   | `/categories`     | admin | Buat kategori                                   |
| PUT    | `/categories/:id` | admin | Edit kategori                                   |
| DELETE | `/categories/:id` | admin | Hapus kategori (guard bila masih dipakai event) |

### 3.4 Events

| Method | Endpoint                           | Role                       | Deskripsi                                                                      |
| ------ | ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/events`                          | —                          | List event publik (filter: nama, kategori, tanggal, lokasi, harga; pagination) |
| GET    | `/events/:slug`                    | —                          | Detail event                                                                   |
| POST   | `/events`                          | organizer, admin           | Buat event (status awal `draft`)                                               |
| PUT    | `/events/:id`                      | organizer (pemilik), admin | Edit event                                                                     |
| DELETE | `/events/:id`                      | organizer (pemilik), admin | Hapus event                                                                    |
| PATCH  | `/events/:id/publish`              | organizer (pemilik), admin | `draft` → `published`                                                          |
| PATCH  | `/events/:id/unpublish`            | organizer (pemilik), admin | `published` → `draft`/`closed`                                                 |
| POST   | `/events/:id/banner`               | organizer (pemilik), admin | Upload banner                                                                  |
| POST   | `/events/:id/attachments`          | organizer (pemilik), admin | Upload lampiran                                                                |
| DELETE | `/attachments/:id`                 | organizer (pemilik), admin | Hapus lampiran                                                                 |
| GET    | `/organizer/events/:id/statistics` | organizer (pemilik), admin | Statistik per event                                                            |

### 3.5 Orders

| Method | Endpoint             | Role                      | Deskripsi                                                     |
| ------ | -------------------- | ------------------------- | ------------------------------------------------------------- |
| POST   | `/orders`            | customer                  | Buat order (cek kuota, hitung total, generate invoice Xendit) |
| GET    | `/orders`            | customer                  | Riwayat order milik user login                                |
| GET    | `/orders/:id`        | customer (pemilik), admin | Detail order                                                  |
| PATCH  | `/orders/:id/cancel` | customer (pemilik)        | Batalkan order `pending`                                      |
| GET    | `/admin/orders`      | admin                     | List seluruh order                                            |
| GET    | `/organizer/orders`  | organizer                 | List order untuk event miliknya                               |

### 3.6 Payments & Webhook

| Method | Endpoint                     | Role                                    | Deskripsi                            |
| ------ | ---------------------------- | --------------------------------------- | ------------------------------------ |
| GET    | `/orders/:id/payment`        | customer (pemilik)                      | Ambil `payment_url` & status terkini |
| GET    | `/orders/:id/payment-status` | customer (pemilik)                      | Polling status pembayaran            |
| POST   | `/api/webhooks/xendit`       | — (diverifikasi via `x-callback-token`) | Callback dari Xendit                 |

### 3.7 Tickets

| Method | Endpoint                | Role               | Deskripsi                       |
| ------ | ----------------------- | ------------------ | ------------------------------- |
| GET    | `/tickets/:id`          | customer (pemilik) | Detail tiket + QR               |
| GET    | `/tickets/:id/download` | customer (pemilik) | Download e-ticket PDF           |
| POST   | `/tickets/scan`         | organizer, admin   | Scan QR → validasi tiket        |
| PATCH  | `/tickets/:id/check-in` | organizer, admin   | Tandai check-in (anti-duplikat) |

### 3.8 Dashboard & Reports

| Method | Endpoint                               | Role      | Deskripsi                                    |
| ------ | -------------------------------------- | --------- | -------------------------------------------- |
| GET    | `/organizer/dashboard`                 | organizer | Total event, tiket terjual, revenue, visitor |
| GET    | `/admin/dashboard`                     | admin     | Total user/event/order/revenue platform      |
| GET    | `/organizer/reports/sales`             | organizer | Laporan penjualan                            |
| GET    | `/organizer/reports/event-performance` | organizer | Performa per event                           |
| GET    | `/admin/reports/revenue`               | admin     | Revenue platform                             |
| GET    | `/admin/reports/users`                 | admin     | Laporan user                                 |
| GET    | `/admin/reports/payments`              | admin     | Laporan pembayaran                           |

---

## 4. Aturan Bisnis (Business Rules)

### 4.1 Order & Kuota Tiket

- `quantity` order **tidak boleh melebihi** `events.available_ticket` saat ini.
- Pengurangan `available_ticket` dan pembuatan `orders` **wajib dalam satu database transaction** (row locking / `SELECT ... FOR UPDATE`) untuk mencegah race condition ketika dua request datang bersamaan pada tiket tersisa terakhir.
- `total_amount = (ticket_price × quantity) + service_fee`.
- `order_number` format: `ORD-{YYYYMMDD}-{6 karakter acak alfanumerik}`, contoh: `ORD-20260706-8F3K2A`.
- Order berstatus `pending` yang melewati `ORDER_EXPIRY_MINUTES` (default 60 menit, dapat dikonfigurasi) di-set otomatis menjadi `expired` oleh scheduled job, dan `available_ticket` dikembalikan.

### 4.2 Ticket & QR Code

- `ticket_code` format: `TIX-{event_id}-{8 karakter acak}`, contoh: `TIX-000123-9J2K7XQ4`.
- `qr_code` meng-encode payload berisi `ticket_code` (dan idealnya ditandatangani/HMAC agar tidak mudah dipalsukan bila di-generate ulang secara manual).
- Satu tiket **hanya bisa check-in satu kali** — endpoint scan/check-in wajib menolak (`409 Conflict`) bila `is_checked_in = true`.
- Tiket hanya digenerate **setelah** `payments.status = paid`, sejumlah `orders.quantity`.

### 4.3 Status Mapping Xendit ↔ Internal

| Status Xendit (`invoice.status`) | `payments.status` | `orders.payment_status` | Aksi                          |
| -------------------------------- | ----------------- | ----------------------- | ----------------------------- |
| `PENDING`                        | `pending`         | `pending`               | —                             |
| `PAID` / `SETTLED`               | `paid`            | `paid`                  | Generate tiket + notifikasi   |
| `EXPIRED`                        | `expired`         | `expired`               | Kembalikan `available_ticket` |
| (gagal/`FAILED`)                 | `failed`          | `cancelled`             | Kembalikan `available_ticket` |

### 4.4 Validasi Umum

| Entity                | Aturan                                 |
| --------------------- | -------------------------------------- |
| `users.email`         | Format email valid, unik               |
| `users.password`      | Minimal 8 karakter saat register/reset |
| `events.event_date`   | Harus < `event_end_date`               |
| `events.ticket_price` | ≥ 0                                    |
| `orders.quantity`     | Integer ≥ 1                            |

---

## 5. Spesifikasi Integrasi Xendit

### 5.1 Environment Variables

```
XENDIT_SECRET_KEY=xnd_development_xxx      # Basic Auth (username), password dikosongkan
XENDIT_CALLBACK_TOKEN=xxx                  # dari Dashboard → Settings → Webhooks
XENDIT_SUCCESS_REDIRECT_URL=${APP_URL}/orders/success
XENDIT_FAILURE_REDIRECT_URL=${APP_URL}/orders/failed
```

### 5.2 Membuat Invoice — `POST https://api.xendit.co/v2/invoices`

Autentikasi: **Basic Auth**, `XENDIT_SECRET_KEY` sebagai username, password dikosongkan.

Contoh payload yang dikirim service (ringkas):

```json
{
  "external_id": "ORD-20260706-8F3K2A",
  "amount": 350000,
  "payer_email": "customer@example.com",
  "description": "Pembayaran tiket: <judul event>",
  "currency": "IDR",
  "invoice_duration": 3600,
  "success_redirect_url": "https://app.example.com/orders/success",
  "failure_redirect_url": "https://app.example.com/orders/failed"
}
```

> `invoice_duration` dalam **detik**; sinkronkan dengan `ORDER_EXPIRY_MINUTES` agar batas waktu order & batas waktu invoice konsisten.

Response penting yang disimpan ke tabel `payments`: `id` (→ `invoice_id`), `invoice_url` (→ `payment_url`), `expiry_date` (→ `expired_at`), `external_id`.

### 5.3 Metode Pembayaran yang Didukung

Xendit Invoice API menyediakan halaman checkout hosted yang otomatis menampilkan pilihan metode berikut (tergantung konfigurasi akun):

| Kategori           | Contoh Channel                     |
| ------------------ | ---------------------------------- |
| Virtual Account    | BCA, BNI, BRI, Mandiri, Permata    |
| E-Wallet           | OVO, DANA, LinkAja, ShopeePay      |
| Kartu Kredit/Debit | Visa, Mastercard, JCB              |
| QRIS               | QR Code lintas aplikasi pembayaran |

### 5.4 Webhook — `POST /api/webhooks/xendit`

Xendit mengirim POST ke webhook URL yang didaftarkan di Dashboard, dengan header `x-callback-token`.

Contoh payload (ringkas):

```json
{
  "id": "593f4ed1c3d3bb7f39733d83",
  "external_id": "ORD-20260706-8F3K2A",
  "status": "PAID",
  "amount": 350000,
  "paid_amount": 350000,
  "payment_method": "VIRTUAL_ACCOUNT",
  "payment_channel": "BCA",
  "paid_at": "2026-07-06T10:32:50.912Z",
  "currency": "IDR"
}
```

**Langkah verifikasi & pemrosesan:**

1. Ambil header `x-callback-token`, bandingkan (constant-time compare) dengan `XENDIT_CALLBACK_TOKEN` di environment. Jika tidak cocok → `401`, hentikan proses.
2. Cari `payments` berdasarkan `external_id` (= `order_number`).
3. **Cek idempotency**: jika `payments.status` sudah `paid`, langsung balas `200` tanpa memproses ulang (mencegah tiket digenerate dobel akibat webhook retry).
4. Update `payments.status`, `payments.paid_at`, `orders.payment_status`, `orders.paid_at`.
5. Jika status `PAID` → generate tickets + QR Code + kirim email.
6. Jika status `EXPIRED` → kembalikan `available_ticket`.
7. Balas `200` secepat mungkin (proses berat dijalankan async/background) — Xendit akan **retry hingga 6 kali dengan exponential backoff** bila tidak menerima respons `2xx`.

---

## 6. Format Response API

### Sukses

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": { "...": "..." }
}
```

### Error

```json
{
  "success": false,
  "message": "Ticket quota is not available",
  "errors": null
}
```

Standar HTTP status: `400` (validasi), `401` (unauthenticated), `403` (unauthorized), `404` (not found), `409` (conflict, misal duplicate check-in), `422` (business rule violation), `500` (server error).

---

## 7. Environment Variables Reference

| Variable                                                                        | Wajib | Keterangan                            |
| ------------------------------------------------------------------------------- | ----- | ------------------------------------- |
| `NODE_ENV`                                                                      | ✅    | `development` / `test` / `production` |
| `PORT`                                                                          | ✅    | Port HTTP                             |
| `APP_URL`                                                                       | ✅    | Base URL publik aplikasi              |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`                       | ✅    | Koneksi MySQL                         |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                                                  | ✅    | Signing token                         |
| `COOKIE_SECRET`                                                                 | ✅    | Signing cookie                        |
| `ORDER_EXPIRY_MINUTES`                                                          | ✅    | Batas waktu order pending             |
| `XENDIT_SECRET_KEY`                                                             | ✅    | Kredensial Xendit                     |
| `XENDIT_CALLBACK_TOKEN`                                                         | ✅    | Verifikasi webhook                    |
| `XENDIT_SUCCESS_REDIRECT_URL`, `XENDIT_FAILURE_REDIRECT_URL`                    | ✅    | Redirect checkout                     |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | ✅    | SMTP notifikasi                       |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`                                        | ✅    | Rate limiting                         |

---

## 8. Non-Functional Requirements

| Aspek                                      | Target                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| Response time (read endpoint)              | p95 < 300ms                                                             |
| Response time (create order + call Xendit) | p95 < 1.5s (bergantung latensi Xendit)                                  |
| Concurrency                                | Row-level locking pada pengurangan kuota tiket                          |
| Uptime                                     | ≥ 99.5% (di luar maintenance terjadwal)                                 |
| Keamanan                                   | Lihat [`architecture.md §13`](./architecture.md#13-arsitektur-keamanan) |
| Webhook reliability                        | Idempotent, harus tetap benar meski menerima payload duplikat           |
