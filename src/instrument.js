// src/instrument.js — CICD-07
//
// WAJIB di-require SEBAGAI BARIS PALING PERTAMA di src/server.js (sebelum
// require('./app') atau apa pun lainnya) — ini persyaratan resmi SDK
// @sentry/node v10+ supaya auto-instrumentation modul lain (http, mysql2,
// dst) berfungsi. Lihat: node_modules/@sentry/node/README.md.
//
// SEPENUHNYA opsional: kalau SENTRY_DSN kosong (default), file ini tidak
// melakukan apa pun — tidak ada request keluar ke Sentry sama sekali, tidak
// ada overhead, aman di-require tanpa akun Sentry sekalipun.
'use strict';

const config = require('./config/env');

if (config.monitoring.sentryDsn) {
  // require di dalam blok if supaya SDK Sentry benar2 tidak disentuh sama
  // sekali kalau tidak dikonfigurasi (bukan cuma "diinisialisasi kosong").
  const Sentry = require('@sentry/node');

  Sentry.init({
    dsn: config.monitoring.sentryDsn,
    environment: config.env,
    tracesSampleRate: config.monitoring.sentryTracesSampleRate,
    // Jangan kirim data pribadi (email, dsb) ke Sentry secara default —
    // aktifkan sadar-sadar kalau memang perlu (lihat docs Sentry ttg PII).
    sendDefaultPii: false,
  });
}
