# Ringkasan: Epic TEST — Testing

Sebelum menulis kode apa pun, saya audit dulu suite yang sudah ada (11 file,
206 test) — ternyata **sudah sangat lengkap** untuk sebagian besar ticket.
Kerja utama di epic ini jadi: verifikasi cakupan yang sudah ada, isi 1 gap
nyata (unit test), dan pasang laporan coverage + ambang batas yang belum ada.

## Status per ticket

| Ticket | Status | Catatan |
|---|---|---|
| **TEST-01** Setup Jest+Supertest | ✅ Sudah ada sebelumnya | `jest@30`, `supertest@7` sudah terpasang & dipakai konsisten di 11 file test |
| **TEST-02** Unit test service layer (order/payment/ticket) | 🆕 **Ditambahkan** | Ini gap nyata — suite yg ada semuanya integration-style (lewat HTTP + DB test asli). Ditambahkan `tests/unit/` — 59 test baru, model Sequelize **di-mock penuh**, jalan tanpa DB sama sekali (~2 detik utk 3 file, vs puluhan detik integration) |
| **TEST-03** Integration test auth | ✅ Sudah ada sebelumnya | `auth.test.js` — register/login/me/logout, termasuk rute web |
| **TEST-04** Integration test event & order | ✅ Sudah ada sebelumnya | `event.test.js` (CRUD, publish, banner, attachment, filter, statistik) + `order.test.js` (create, race-condition, cancel, auto-expire) — sangat menyeluruh |
| **TEST-05** Test webhook Xendit (mock + idempotency) | ✅ Sudah ada sebelumnya, **sangat baik** | `payment.test.js` sudah menguji persis yang diminta: payload mock, PAID/EXPIRED, **dan idempotency** (webhook sama dikirim 2x → tiket cuma dibuat sekali; bahkan kondisi race pengiriman bersamaan) |
| **TEST-06** Coverage report & ambang batas | 🆕 **Ditambahkan** | Belum ada sama sekali sebelumnya — dibuatkan `jest.config.js` |

## Yang ditambahkan secara konkret

### `tests/unit/` (TEST-02) — 59 test baru, 3 file

Beda sengaja dari suite integration yang sudah ada: `jest.mock('../../src/models')`
mengganti SELURUH model Sequelize dengan mock — nol koneksi database. Fokus
menguji logika/percabangan yang sulit/lambat diverifikasi lewat integration
test murni:

- **`order.service.test.js`** (23 test): kalkulasi subtotal/fee/total, retry
  order-number kalau bentrok, pengurangan kuota tepat sejumlah quantity,
  row-lock dipakai (bukan plain read), seluruh validasi (quantity, event
  tidak aktif/lewat tanggal/kuota habis), otorisasi getOrderById/cancelOrder,
  pagination, job auto-expire
- **`payment.service.test.js`** (21 test): payload ke Xendit persis benar,
  lazy-retry payment_url, **idempotency utk PAID *dan* EXPIRED *dan* FAILED**
  (loop `it.each`), notifikasi terkirim SETELAH transaksi selesai (bukan di
  dalamnya), **cabang status FAILED yang sebelumnya belum ada test-nya sama
  sekali** (beda dari EXPIRED: `payments.status='failed'` tapi
  `orders.payment_status` tetap `'expired'` krn enum order memang tidak
  punya nilai `'failed'`)
- **`ticket.service.test.js`** (15 test): matriks otorisasi lengkap
  (owner/organizer/admin/orang lain), scan QR dengan **signature ASLI**
  (bukan di-mock — supaya kasus signature dipalsukan benar-benar teruji),
  fallback scan ticket_code polos, tiket yang sudah check-in ditolak

### `jest.config.js` (TEST-06) — baru dibuat

```
npm run test:coverage
```

Ambang batas minimum (build gagal kalau di bawah ini): **statements 80%,
branches 60%, functions 80%, lines 80%** — dipasang ~7-8 poin di bawah
baseline aktual (87.89 / 67 / 88.42 / 88.17%) sekarang, jadi cukup ketat
untuk menangkap regresi cakupan sungguhan tapi tidak rapuh oleh perubahan kecil.
**Sudah diverifikasi gate-nya benar-benar bekerja** (dites dgn ambang 99%
sengaja — build gagal dgn pesan jelas per-metrik seperti seharusnya).

`collectCoverageFrom` sengaja mengecualikan migrations/seeders/`server.js`/
`jobs/` (bukan business logic, "teruji" lewat cara lain) dan
`controllers/web`+`routes/web` (rute EJS, di luar cakupan epic ini — sudah
diverifikasi manual end-to-end di Epic FE/SEC sebelumnya) — supaya angka
persentase benar-benar mencerminkan kualitas test business logic, bukan
tercampur kode yang memang belum waktunya diukur dengan cara ini. Alasan
detail tiap pengecualian ada di komentar `jest.config.js` sendiri.

## Satu bug kecil yang ditemukan & diperbaiki

`tests/health.test.js` adalah **satu-satunya** dari 11 file test yang tidak
menutup koneksi database (`db.sequelize.close()`) di `afterAll` — 10 file
lain sudah konsisten melakukannya. Akibatnya, kalau seluruh suite dijalankan
bersamaan, Jest tidak keluar bersih ("Jest did not exit one second after the
test run..."). Diperbaiki dengan menambahkan `afterAll` yang sama seperti
file lain — sudah diverifikasi warning-nya hilang setelah perbaikan.

## Cara jalanin

```bash
cp .env.example .env.test   # sesuaikan DB_NAME kalau perlu, lalu:
NODE_ENV=test npm run db:create && NODE_ENV=test npm run db:migrate && NODE_ENV=test npm run db:seed
npm test                    # 265/265 test
npm run test:coverage       # + laporan coverage/lcov-report/index.html
```
