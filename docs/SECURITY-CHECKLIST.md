# Security Checklist — Event Management System

Dokumen ini merangkum implementasi Epic **SEC — Security Hardening**: apa yang
sudah dikerjakan per ticket, apa yang WAJIB dilakukan sebelum deploy ke
production, dan trade-off yang disengaja beserta alasannya.

---

## SEC-01 — Helmet (security headers + CSP)

**Implementasi:** `src/middlewares/security.middleware.js`, dipasang di `app.js`.

- Content-Security-Policy dengan **nonce per-request** untuk `script-src`
  (bukan `unsafe-inline`) — setiap `<script>` inline di view mendapat
  `nonce="<%= cspNonce %>"` yang di-generate ulang tiap request
  (`crypto.randomBytes(16)`).
- Seluruh `onclick=`/`onsubmit=` inline di view **dihapus**, direfactor jadi
  `addEventListener` di dalam `<script nonce="...">` — supaya `script-src-attr`
  bisa di-set `'none'` (tidak ada satupun inline event handler attribute lagi).
- Header standar helmet lain (X-Content-Type-Options, X-Frame-Options,
  HSTS, dll) aktif dengan default helmet v8.

**Trade-off yang disengaja:** `style-src` menyertakan `'unsafe-inline'`.
Frontend memakai Tailwind lewat **Play CDN** (`cdn.tailwindcss.com`) yang
menyuntik `<style>` ke DOM saat runtime lewat JavaScript pihak ketiga — tanpa
nonce, dan kita tidak bisa menambahkannya karena bukan script milik kita.
Tailwind sendiri mendokumentasikan Play CDN "should not be used in
production", sebagian karena hal ini.

Mitigasi: **script-src TETAP ketat** (nonce-only, tanpa `unsafe-inline`) —
vektor paling berbahaya (eksekusi JavaScript) tertutup penuh. Yang terbuka
cuma injeksi CSS, jauh lebih terbatas dampaknya (UI redress, bukan pencurian
data/eksekusi kode).

> **Follow-up yang direkomendasikan (di luar cakupan epic ini):** compile
> Tailwind ke file CSS statis lewat build step (`tailwindcss` CLI/PostCSS),
> hapus tag `<script src="cdn.tailwindcss.com">`, lalu `style-src` bisa
> diketatkan sepenuhnya jadi `'self'` saja.

`crossOriginEmbedderPolicy` di-nonaktifkan — CDN pihak ketiga yang dipakai
(Tailwind, Font Awesome/cdnjs, ui-avatars.com) umumnya tidak mengirim header
`Cross-Origin-Resource-Policy`, jadi COEP `require-corp` justru akan
memblokir aset itu sendiri, bukan menambah keamanan.

---

## SEC-02 — CORS whitelist

**Implementasi:** `src/middlewares/security.middleware.js`, di-mount khusus
di `/api/v1/*` (`corsMiddleware`). Rute web (EJS) sengaja **tidak** dipasangi
CORS — itu form submission same-origin biasa, tidak butuh header CORS.

- Whitelist origin dari `CORS_ALLOWED_ORIGINS` (env, pisahkan koma).
- Request tanpa header `Origin` (curl, server-to-server, mobile native)
  tetap diizinkan — itu bukan skenario yang CORS lindungi.
- Origin yang ditolak → `403 Forbidden` yang jelas (bukan 500 generik).
- `credentials: true` — cookie JWT httpOnly tetap bisa dipakai lintas origin
  yang di-whitelist (relevan kalau nanti ada SPA/mobile-web terpisah).

**Checklist sebelum production:**
- [ ] Set `CORS_ALLOWED_ORIGINS` ke domain frontend production yang sebenarnya
      (jangan biarkan `http://localhost:3000`).

---

## SEC-03 — Rate limiting

**Implementasi:** `src/middlewares/rateLimiter.middleware.js`.

| Limiter | Cakupan | Batas | Catatan |
|---|---|---|---|
| `generalApiLimiter` | seluruh `/api/v1/*` | `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (default 100/15mnt) | jaring pengaman umum |
| `authLimiter` | login, register, forgot/reset-password, change-password — **web & API berbagi instance yang sama** | 10 percobaan **gagal**/15mnt/IP | `skipSuccessfulRequests: true` — login sukses tidak menghukum user sah |
| `webhookLimiter` | `POST /api/webhooks/xendit` | 60/menit | jauh lebih longgar — utk cegah flood/DoS, bukan membatasi traffic Xendit yang sah |

Semua limiter **di-nonaktifkan otomatis saat `NODE_ENV=test`** (lihat
komentar di file) — supaya test suite (11 file, `--runInBand`, berbagi satu
in-memory store) tidak salah kena limit hanya karena banyak memanggil
`/auth/login` secara berturutan.

**Checklist sebelum production:**
- [ ] Set `TRUST_PROXY` sesuai topologi nyata (jumlah reverse proxy di
      depan app). **Jangan asal isi `1`** kalau ternyata tidak ada proxy —
      itu justru membuka celah spoofing `X-Forwarded-For` yang bisa dipakai
      membypass rate limiting.
- [ ] Kalau traffic tinggi & multi-instance, pertimbangkan store terpusat
      (Redis) untuk `express-rate-limit` — default-nya in-memory per-proses,
      artinya tiap instance server punya jatah sendiri-sendiri.

---

## SEC-04 — Validasi & sanitasi input

**Temuan:** sisi API (`/api/v1/*`) **sudah lengkap** di seluruh endpoint —
setiap rute sudah dipasangi `express-validator` (trim, normalizeEmail,
isInt, isLength, dst) sebelum perubahan ini dimulai.

**Yang ditambahkan:** sisi web (EJS) yang sebelumnya beberapa rute belum
tervalidasi formal, sekarang memakai **validator yang sama persis** dengan
API (satu sumber kebenaran, tidak didefinisikan ulang):

- `POST /orders` → `validateCreateOrder`
- `POST /auth/profile`, `POST /auth/change-password` → `validateUpdateProfile`, `validateChangePassword`
- Seluruh `:id`/`:slug` numerik di rute web (`/events/:id/edit`, `/orders/:id`,
  `/tickets/:id`, dst) → `validateEventId` / `validateOrderId` / `validateTicketId`
  — menolak ID bukan-angka lebih awal dengan pesan jelas, bukan diteruskan
  mentah ke query database.
- Form create/edit event tetap pakai validasi manual (`validateEventForm`
  di controller) yang sudah ada — bukan express-validator, tapi
  fungsinya setara (panjang field, tipe data, rentang angka, tanggal).

---

## SEC-05 — Proteksi XSS

- **Audit menyeluruh** seluruh 37 file `.ejs`: setiap output data dinamis
  memakai `<%= %>` (auto-escape HTML entities). Satu-satunya pemakaian
  `<%- %>` (unescaped) adalah untuk `include()` partial, injeksi `body` layout
  (express-ejs-layouts), dan hook `extraHead` yang **tidak pernah diisi data
  apa pun** oleh controller manapun saat ini — nol risiko.
- Variabel yang disisipkan ke dalam blok `<script>` (bukan cuma HTML biasa)
  di-cek terpisah: hanya `cspNonce` (random server-side) dan
  `JSON.stringify(Number(event.ticketPrice))`/`serviceFeePercentage` (angka
  dari DB/config, bukan string bebas dari user) — aman dari context-breakout.
- Upload banner/attachment dibatasi tipe MIME (`jpeg`/`png`/`webp` untuk
  gambar, + `pdf`/`doc`/`docx` untuk attachment) — **SVG sengaja tidak
  diizinkan** (SVG bisa memuat `<script>`, vektor XSS umum untuk fitur upload
  gambar).
- CSP dari SEC-01 jadi lapisan pertahanan kedua: walau ada celah XSS yang
  lolos di masa depan, `script-src` tanpa `unsafe-inline` mencegah payload
  itu benar-benar tereksekusi.

---

## SEC-06 — Proteksi CSRF

**Implementasi:** `src/middlewares/csrf.middleware.js`, pola **double-submit
cookie** lewat `csrf-csrf` (stateless — cocok karena app ini pakai JWT,
bukan `express-session`).

- `getSessionIdentifier` memakai JWT dari cookie httpOnly kalau user login
  (anjuran resmi dokumentasi csrf-csrf: "typically session id or JWT") —
  token CSRF otomatis invalid kalau JWT berganti (logout/login ulang/login
  sbg user lain).
- Cookie token CSRF: `__Host-ems.csrf-token` di production (butuh HTTPS +
  `COOKIE_SECURE=true`), `ems.csrf-token` biasa di development.
- Token dibaca dari **body form** (`_csrf` hidden input), bukan header —
  sesuai cara kerja form EJS tradisional, bukan SPA/AJAX.
- **Scope: rute web (EJS) saja**, tidak dipasang di `/api/v1/*` maupun
  webhook. Alasannya: SEC-06 secara eksplisit menyebut "form EJS"; API JSON
  ditujukan utk konsumen non-browser (mobile app, integrasi server-to-server)
  yang tidak bisa melakukan handshake token CSRF berbasis form/cookie.
  Cookie JWT sudah diberi `SameSite=Strict` (mitigasi CSRF independen,
  browser modern tidak akan mengirim cookie itu sama sekali pada request
  lintas situs) — lapisan tambahan untuk permukaan API kalau dianggap perlu
  di masa depan: pertimbangkan mewajibkan API hanya menerima `Authorization:
  Bearer` (hapus fallback cookie) supaya benar-benar tidak bergantung ke
  ambient cookie auth sama sekali.
- Total **17 form POST** di seluruh EJS sudah disisipi
  `<%- include('.../csrf-field') %>`, termasuk form multipart (edit event +
  upload banner — urutan middleware penting: CSRF check diletakkan SETELAH
  `multer`, karena `req.body._csrf` baru terisi setelah multer selesai parsing).
- Sudah diuji end-to-end: submit tanpa token → `403`; submit dengan token
  valid → berhasil; submit multipart dengan banner + token → berhasil.

---

## SEC-07 — Audit proteksi SQL Injection

**Hasil audit: tidak ditemukan celah.** Seluruh akses data lewat model
Sequelize (`db.Model.findAll/create/update`, dst — otomatis ter-parameterisasi).

Satu-satunya raw query (`sequelize.query`) ada di `dashboard.service.js`
(laporan admin/organizer) — diperiksa baris per baris:
- Filter tanggal dinamis dibangun dengan **placeholder bernama**
  (`created_at >= :startDate`), nilai sebenarnya dikirim lewat opsi
  `replacements`, bukan digabung langsung ke string SQL.
- `startDate`/`endDate` sendiri sudah divalidasi `isISO8601()` di
  `dashboard.validation.js` sebelum sampai ke service — lapisan kedua.

Tidak ada satupun tempat yang menggabungkan input request langsung ke
dalam string query (`` `WHERE x = ${req.query.x}` `` atau sejenisnya).

---

## SEC-08 — Kekuatan hashing password & JWT secret

- **bcrypt**: `BCRYPT_SALT_ROUNDS=12` (default config), dipakai konsisten
  di seluruh pembuatan/pengubahan password — nilai standar modern yang
  direkomendasikan (OWASP: minimum 10, 12–14 utk hardware saat ini).
- **JWT**: `jwt.sign()`/`jwt.verify()` sekarang eksplisit di-pin
  `algorithm/algorithms: 'HS256'` — mencegah algorithm-confusion meskipun
  library & kondisi saat ini sebenarnya sudah aman secara default; ini
  murni defense-in-depth & eksplisit sesuai OWASP JWT Cheat Sheet.
- **Cookie `secure` flag**: web controller sebelumnya baca `NODE_ENV`
  langsung, sekarang konsisten pakai `config.auth.cookieSecure` (satu
  sumber kebenaran, sama seperti API controller).
- **Startup guard baru**: app **menolak start di `NODE_ENV=production`**
  kalau `JWT_SECRET`/`COOKIE_SECRET`/`CSRF_SECRET` masih nilai contoh dari
  `.env.example` (`replace_with...`) atau lebih pendek dari 32 karakter.
  Development/test tidak terpengaruh (supaya clone-dan-coba tetap mudah).

**Checklist sebelum production (WAJIB, app akan menolak start kalau tidak):**
- [ ] Generate `JWT_SECRET`, `COOKIE_SECRET`, `CSRF_SECRET` baru & berbeda
      satu sama lain: `openssl rand -hex 32`
- [ ] Set `COOKIE_SECURE=true` (butuh app benar-benar diakses via HTTPS)
- [ ] Ganti `XENDIT_SECRET_KEY`/`XENDIT_CALLBACK_TOKEN` ke kredensial live,
      set `XENDIT_SUCCESS_REDIRECT_URL`/`FAILURE_REDIRECT_URL` ke domain asli

---

## SEC-09 — Checklist pra-produksi & dependency review

### `npm audit` (per tanggal implementasi)

Setelah `npm audit fix` (mode aman, non-breaking):

| Paket | Severity | Status | Alasan tidak di-force-fix |
|---|---|---|---|
| `brace-expansion` (lewat `eslint`/`jest`/`sequelize-cli`) | High (ReDoS) | Dibiarkan | **Seluruhnya devDependencies** (linting/testing/migration CLI) — tidak ada di runtime path production sama sekali. Fix butuh downgrade `sequelize-cli`, ditunda sampai ada patch resmi. |
| `uuid` <11.1.1 (transitive lewat `sequelize`) | Moderate | Dibiarkan | Celahnya spesifik di path `uuid(name, namespace, **buf**, offset)` — dicek: **tidak ada satupun model** di app ini yang pakai `DataTypes.UUID`/`UUIDV4` (semua PK pakai `BIGINT AUTO_INCREMENT`), jadi path yang rentan itu tidak pernah benar-benar dipanggil. Fix (`npm audit fix --force`) akan **downgrade Sequelize ke v3.30.0** — breaking change besar, tidak sepadan untuk risiko yang secara praktis tidak reachable. |

**Rekomendasi:** jalankan `npm audit` ulang secara berkala (mis. bagian dari
CI bulanan) — begitu Sequelize/sequelize-cli merilis versi yang membawa
`uuid`/`brace-expansion` versi aman, upgrade rutin tanpa perlu force-downgrade.

### Checklist umum sebelum deploy

- [ ] Semua item "Checklist sebelum production" di atas (SEC-02, 03, 08)
- [ ] `NODE_ENV=production`
- [ ] `.env` production **tidak pernah** ter-commit ke git (sudah di
      `.gitignore`, tapi verifikasi manual sekali lagi)
- [ ] Database pakai user MySQL dengan privilege terbatas (bukan `root`) —
      hanya `SELECT/INSERT/UPDATE/DELETE` pada database aplikasi
- [ ] Jalankan `npm run test` — pastikan 206/206 test tetap hijau setelah
      perubahan apa pun
- [ ] Jalankan `npm audit` — pastikan tidak ada temuan BARU severity
      tinggi di dependency production
- [ ] Reverse proxy (nginx/dst) yang menghadap publik menangani TLS
      termination; `TRUST_PROXY` disetel sesuai jumlah hop proxy itu
