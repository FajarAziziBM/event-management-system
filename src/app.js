// src/app.js
'use strict';

const path = require('node:path');

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./config/env');
const logger = require('./config/logger');
const { flashMiddleware } = require('./utils/flash');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const { cspNonce, helmetMiddleware, corsMiddleware } = require('./middlewares/security.middleware');
const { generalApiLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// SEC-03: hanya percaya header X-Forwarded-For sejauh hop yang dikonfigurasi
// eksplisit (lihat config/env.js) — supaya req.ip akurat di belakang reverse
// proxy TANPA membuka celah spoofing IP kalau ternyata tidak ada proxy.
if (config.trustProxy > 0) {
  app.set('trust proxy', config.trustProxy);
}

// --- View engine (SETUP-09) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);

// --- Security middleware (helmet, cors, rate-limit) — Epic SEC ---
// cspNonce HARUS sebelum helmetMiddleware: directive CSP script-src di bawah
// membaca res.locals.cspNonce yang baru diisi middleware ini.
app.use(cspNonce);
app.use(helmetMiddleware);
// CORS di-scope ke /api/v1 saja — rute web (EJS) adalah same-origin form
// submission biasa yang tidak butuh (dan tidak diuntungkan oleh) header CORS.
app.use('/api/v1', corsMiddleware);
app.use('/api/v1', generalApiLimiter);

// --- Body & cookie parsing ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.auth.cookieSecret));

// --- Static assets ---
app.use(express.static(path.join(__dirname, 'public')));

// --- HTTP access log (SETUP-06) — dipipe ke Winston, bukan stdout langsung ---
app.use(morgan('combined', { stream: logger.stream }));

// --- Middleware untuk pass user ke semua EJS views, bahkan jika belum login ---
const { authenticateOptional } = require('./middlewares/auth.middleware');

app.use(authenticateOptional);
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  // File-file (banner event, dll) disimpan sebagai path relatif disk
  // (mis. 'src/public/uploads/...'); helper ini menyederhanakannya jadi URL
  // yang bisa langsung dipakai di <img src="...">, karena src/public sendiri
  // sudah di-serve sebagai root statis di atas.
  res.locals.assetUrl = (relPath) =>
    relPath ? `/${relPath.replace(/^src[\\/]public[\\/]?/, '')}` : null;

  // Helper format Rupiah & tanggal Indonesia — dipakai di banyak view (events, orders, tickets)
  res.locals.formatCurrency = (amount) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
      Number(amount) || 0,
    );
  res.locals.formatDate = (date) =>
    date
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(date),
        )
      : '-';
  res.locals.formatDateTime = (date) =>
    date
      ? `${new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(date))}, ${new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(date))} WIB`
      : '-';
  next();
});
app.use(flashMiddleware);

// --- Routes ---
app.use(routes);

// CICD-07: Sentry HARUS ditempel SETELAH seluruh route, SEBELUM error handler
// milik app sendiri — supaya Sentry sempat menangkap detail error dulu,
// lalu tetap diteruskan ke errorHandler kita utk membentuk respons yg dilihat
// user. Tidak melakukan apa pun kalau SENTRY_DSN kosong (lihat src/instrument.js).
if (config.monitoring.sentryDsn) {
  require('@sentry/node').setupExpressErrorHandler(app);
}

// --- 404 & global error handler (SETUP-07) — HARUS paling akhir ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
