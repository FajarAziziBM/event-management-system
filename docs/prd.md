# 📋 Product Requirements Document (PRD) — Event Management System

## 1. Ringkasan Eksekutif

Event Management System (EMS) adalah platform backend yang menghubungkan **Organizer** (penyelenggara event) dengan **Customer** (pembeli tiket), lengkap dengan pemrosesan pembayaran otomatis melalui Xendit dan penerbitan e-ticket berbasis QR Code. Sistem juga menyediakan panel **Admin** untuk mengelola keseluruhan platform.

## 2. Latar Belakang & Problem Statement

Penyelenggaraan event secara manual (pendaftaran via form/WhatsApp, pembayaran manual transfer, tiket fisik/screenshot) rentan terhadap:

- Human error dalam rekonsiliasi pembayaran.
- Tidak ada validasi kuota real-time → risiko overselling.
- Tiket mudah dipalsukan/diduplikasi tanpa mekanisme check-in yang terverifikasi.
- Organizer tidak punya visibilitas data penjualan secara real-time.

EMS menjawab masalah ini dengan alur pemesanan-pembayaran-tiket yang terotomasi end-to-end.

## 3. Tujuan Produk

1. Memungkinkan organizer membuat & mengelola event secara mandiri (self-service).
2. Menyediakan alur pembelian tiket yang aman, dengan validasi kuota real-time.
3. Mengotomasi rekonsiliasi pembayaran melalui integrasi payment gateway (Xendit) + webhook.
4. Menyediakan e-ticket (QR Code) yang dapat divalidasi saat check-in untuk mencegah duplikasi masuk.
5. Memberi visibilitas data (dashboard & laporan) bagi organizer dan admin.

## 4. Target Pengguna

| Persona | Deskripsi |
|---|---|
| **Customer** | Individu yang ingin membeli tiket event (konser, workshop, seminar, dll). Butuh alur beli-bayar-dapat tiket yang cepat & jelas statusnya. |
| **Organizer** | Penyelenggara event (individu/komunitas/perusahaan). Butuh kontrol penuh atas event miliknya: konten, kuota, harga, dan laporan penjualan. |
| **Admin** | Pengelola platform. Butuh visibilitas & kontrol penuh atas seluruh user, event, order, dan pembayaran di sistem. |

## 5. User Stories

### Customer

- Sebagai Customer, saya ingin **mendaftar akun**, agar saya bisa memesan tiket.
- Sebagai Customer, saya ingin **mencari & memfilter event** (nama, kategori, tanggal, lokasi, harga), agar saya cepat menemukan event yang relevan.
- Sebagai Customer, saya ingin **melihat detail event**, agar saya tahu informasi lengkap sebelum membeli.
- Sebagai Customer, saya ingin **memesan tiket dengan jumlah tertentu**, agar saya bisa membeli untuk diri sendiri/rombongan.
- Sebagai Customer, saya ingin **membayar melalui metode pilihan saya** (VA/E-Wallet/Kartu/QRIS), agar prosesnya fleksibel.
- Sebagai Customer, saya ingin **status pembayaran saya diperbarui otomatis**, agar saya tidak perlu konfirmasi manual.
- Sebagai Customer, saya ingin **mengunduh e-ticket berisi QR Code**, agar saya bisa menunjukkannya saat masuk venue.
- Sebagai Customer, saya ingin **melihat riwayat pesanan saya**, agar saya bisa memantau transaksi sebelumnya.
- Sebagai Customer, saya ingin **membatalkan order yang belum dibayar**, agar tidak menunggu kedaluwarsa bila berubah pikiran.

### Organizer

- Sebagai Organizer, saya ingin **membuat & mengedit event** (jadwal, lokasi, harga, kuota, kategori), agar saya punya kontrol penuh atas konten event.
- Sebagai Organizer, saya ingin **mengunggah banner & lampiran event**, agar event saya terlihat menarik dan informatif.
- Sebagai Organizer, saya ingin **mem-publish/unpublish event**, agar saya bisa mengatur kapan event terlihat publik.
- Sebagai Organizer, saya ingin **melihat daftar order untuk event saya**, agar saya tahu siapa saja yang sudah membeli.
- Sebagai Organizer, saya ingin **memindai QR Code tiket saat check-in**, agar validasi kehadiran cepat dan tidak bisa dipalsukan/diduplikasi.
- Sebagai Organizer, saya ingin **melihat dashboard & laporan penjualan**, agar saya bisa mengevaluasi performa event saya.

### Admin

- Sebagai Admin, saya ingin **mengelola seluruh user** (buat, edit, hapus, ubah role, suspend), agar platform tetap terkontrol.
- Sebagai Admin, saya ingin **mengelola kategori event**, agar taksonomi event tetap rapi.
- Sebagai Admin, saya ingin **melihat & mengelola seluruh event/order/payment**, agar saya bisa melakukan moderasi bila diperlukan.
- Sebagai Admin, saya ingin **melihat dashboard platform** (total user, event, order, revenue), agar saya punya gambaran kesehatan bisnis secara keseluruhan.

## 6. Functional Requirements

Ringkasan per modul (detail teknis di [`specification.md`](./specification.md)):

| # | Modul | Ringkasan Requirement |
|---|---|---|
| 1 | Authentication | Register, login, logout, forgot/reset password, update profil, ganti password |
| 2 | Event Management | CRUD event, publish/unpublish, upload banner & lampiran, statistik per event |
| 3 | Category Management | CRUD kategori (admin) |
| 4 | Ticket Ordering | Buat order, validasi kuota, kalkulasi total, generate nomor order, riwayat & pembatalan order |
| 5 | Payment | Pilih metode bayar via Xendit, cek status, webhook otomatis update status |
| 6 | Ticket Management | Generate ticket code & QR, lihat/unduh tiket, scan & check-in, cegah duplikat check-in |
| 7 | Order Management | Riwayat order (customer), order per event (organizer), kelola seluruh order (admin) |
| 8 | User Management | CRUD user, ubah role, suspend (admin) |
| 9 | Dashboard | Dashboard Organizer & Admin |
| 10 | Reports | Laporan penjualan/revenue/performa event (organizer), laporan platform (admin) |
| 11 | Search & Filter | Pencarian event (customer), order/tiket (organizer), data platform (admin) |
| 12 | Notifications | Email untuk lifecycle order/payment/event |
| 13 | File Management | Upload/hapus banner & lampiran event |
| 14 | Security | RBAC, hashing password, CSRF/XSS/SQLi protection, rate limiting |

## 7. Non-Functional Requirements

- **Keamanan**: RBAC ketat per role, seluruh input tervalidasi, password di-hash, secret via environment variable.
- **Performa**: Endpoint publik (browse event) responsif meski traffic naik saat event populer dirilis.
- **Reliabilitas**: Status pembayaran harus konsisten meski webhook terlambat/duplikat (idempotent).
- **Maintainability**: Struktur folder & layering konsisten (lihat `architecture.md`) agar mudah dikembangkan tim.
- **Portability**: Konfigurasi environment-based agar mudah deploy ke staging/production berbeda.

## 8. Ruang Lingkup

### Termasuk (In Scope — versi awal)

Seluruh modul pada tabel Functional Requirements di atas.

### Di Luar Ruang Lingkup (Future Features)

- Coupon / Voucher, Discount Campaign, Promo Code
- Multiple Ticket Types (VIP, Regular, Early Bird) & Seat Reservation
- Waiting List, Wishlist, Favorite Events
- Reviews & Ratings, Event Comments
- Organizer Verification, Refund Request
- Invoice PDF terpisah, Email Ticket (lampiran otomatis)
- Push Notification, Google Calendar Integration, Google Maps Integration
- Multi Payment Gateway (di luar Xendit), Multi Language, Dark Mode

## 9. Asumsi & Batasan

- Mata uang transaksi: **IDR** (mengikuti dukungan utama Xendit untuk pasar Indonesia).
- Webhook Xendit membutuhkan endpoint publik ber-HTTPS — pengujian lokal memerlukan tunnel (ngrok atau sejenis).
- Satu order hanya untuk satu event (tidak ada multi-event checkout dalam satu order).
- Refund pembayaran adalah fitur masa depan; versi awal hanya menandai status `refunded` tanpa alur otomatis ke Xendit.

## 10. Kriteria Keberhasilan (Success Metrics)

| Metrik | Target Indikatif |
|---|---|
| Tingkat keberhasilan checkout (order → paid) | Dipantau per minggu, dibandingkan dengan order `expired`/`cancelled` |
| Waktu dari `payment PAID` (webhook) hingga tiket tersedia | < 5 detik |
| Tingkat keberhasilan pemrosesan webhook | 100% idempotent, tanpa tiket dobel meski ada retry |
| Kegagalan check-in akibat duplikat | 0 (dicegah oleh sistem) |
| Uptime API | ≥ 99.5% |

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Race condition kuota tiket saat traffic tinggi | Transaction + row locking pada pengurangan `available_ticket` |
| Webhook Xendit terlambat/duplikat/gagal terkirim | Idempotency check, endpoint webhook merespons cepat, memanfaatkan retry otomatis Xendit |
| Downtime payment gateway | Order tetap `pending` hingga expired; komunikasikan status jelas ke customer |
| Penyalahgunaan endpoint webhook oleh pihak luar | Verifikasi `x-callback-token`, disarankan IP whitelisting |
| Kebocoran secret/API key | Seluruh kredensial via environment variable, tidak pernah masuk repository |
