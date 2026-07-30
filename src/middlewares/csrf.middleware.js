// src/middlewares/csrf.middleware.js
'use strict';

const { doubleCsrf } = require('csrf-csrf');

const config = require('../config/env');
const { ForbiddenError } = require('../utils/errors');

/**
 * SEC-06: proteksi CSRF untuk form EJS (bukan /api/v1/*, lihat catatan di
 * SECURITY-CHECKLIST.md ttg kenapa API di-scope terpisah) — pola double-
 * submit cookie (stateless, cocok karena app ini pakai JWT bukan express-session).
 *
 * getSessionIdentifier: dokumentasi csrf-csrf eksplisit bilang ini "typically
 * session id or JWT" — kita pakai JWT dari cookie httpOnly kalau user login,
 * supaya token CSRF otomatis tidak valid lagi kalau JWT berganti (login ulang/
 * logout/login sbg user lain). Untuk visitor anonim (halaman login/register
 * itu sendiri) pakai konstanta tetap — perlindungan CSRF tetap jalan lewat
 * pencocokan cookie<->token double-submit, identifier tambahan ini terutama
 * berguna untuk state yang SUDAH terautentikasi.
 */
const { generateCsrfToken, validateRequest } = doubleCsrf({
  getSecret: () => config.auth.csrfSecret,
  getSessionIdentifier: (req) => req.cookies.token || 'anonymous',
  cookieName: config.auth.cookieSecure ? '__Host-ems.csrf-token' : 'ems.csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: config.auth.cookieSecure,
    httpOnly: true,
  },
  // Form EJS mengirim token lewat hidden input '_csrf' di body, BUKAN header —
  // eksplisit satu sumber saja (bukan fallback header||body) sesuai anjuran
  // dokumentasi csrf-csrf untuk menghindari ambiguitas ala celah lama csurf.
  getCsrfTokenFromRequest: (req) => req.body && req.body._csrf,
});

/**
 * Isi res.locals.csrfToken supaya semua view EJS bisa taruh
 * <input type="hidden" name="_csrf" value="<%= csrfToken %>">. Dipanggil di
 * SETIAP request (bukan cuma GET) — generateCsrfToken juga yang pasang cookie-nya.
 */
function attachCsrfToken(req, res, next) {
  res.locals.csrfToken = generateCsrfToken(req, res);
  next();
}

/**
 * Validasi token CSRF untuk request yang mengubah state (POST/PUT/PATCH/DELETE).
 * Ditempel manual per-rute (bukan blanket di seluruh web router) karena satu
 * rute (edit event + upload banner) pakai multipart/form-data — di situ
 * req.body._csrf baru terisi SETELAH multer jalan, jadi middleware ini harus
 * ditaruh SETELAH middleware upload pada rute itu secara spesifik.
 */
function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  if (!validateRequest(req)) {
    return next(
      new ForbiddenError(
        'Sesi form sudah kedaluwarsa atau tidak valid (proteksi CSRF). Silakan muat ulang halaman dan coba lagi.',
      ),
    );
  }
  return next();
}

module.exports = { attachCsrfToken, requireCsrf };
