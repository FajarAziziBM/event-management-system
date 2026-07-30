// src/middlewares/security.middleware.js
'use strict';

const crypto = require('node:crypto');

const helmet = require('helmet');
const cors = require('cors');

const config = require('../config/env');
const logger = require('../config/logger');
const { ForbiddenError } = require('../utils/errors');

/**
 * SEC-01/SEC-05: generate nonce baru per-request, dipakai untuk mengizinkan
 * <script nonce="..."> inline TERTENTU tanpa harus membuka script-src dengan
 * 'unsafe-inline' (yang berarti SEMUA inline script diizinkan, termasuk yang
 * disuntik XSS). Harus jalan SEBELUM helmet, karena directive CSP di bawah
 * membaca res.locals.cspNonce lewat function, dievaluasi per-request oleh helmet.
 */
function cspNonce(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

/**
 * SEC-01: helmet — security headers + Content-Security-Policy.
 *
 * Catatan ttg satu kompromi yang disengaja: style-src butuh 'unsafe-inline'
 * karena frontend memakai Tailwind via Play CDN (<script src="cdn.tailwindcss.com">),
 * yang bekerja dengan MENYUNTIK <style> ke DOM saat runtime lewat JS — tanpa
 * nonce, dan kita tidak bisa menambahkannya karena itu script pihak ketiga.
 * Tailwind sendiri mendokumentasikan Play CDN "should not be used in production"
 * justru sebagian karena hal ini. Mitigasi risikonya: script-src TETAP ketat
 * (nonce-only, tanpa 'unsafe-inline') — vektor paling berbahaya (eksekusi JS)
 * tetap tertutup; yang terbuka cuma injeksi CSS lewat style-src, yang jauh
 * lebih terbatas dampaknya (bisa dipakai utk UI redress, bukan pencurian data
 * atau eksekusi kode). Perbaikan idealnya: compile Tailwind ke file CSS statis
 * (build step) dan hapus Play CDN sepenuhnya — di luar cakupan epic SEC ini,
 * direkomendasikan sebagai follow-up terpisah (lihat SECURITY-CHECKLIST.md).
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
        'https://cdn.tailwindcss.com',
      ],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
      // data: -> QR code tiket dikirim sebagai base64 data URI (bukan file di disk)
      imgSrc: ["'self'", 'data:', 'https://ui-avatars.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  // Tailwind CDN / cdnjs / ui-avatars pihak ketiga umumnya tidak kirim header
  // Cross-Origin-Resource-Policy yang dibutuhkan COEP 'require-corp' — kalau
  // dipaksakan aktif, aset2 itu malah DIBLOKIR browser, bukan lebih aman.
  crossOriginEmbedderPolicy: false,
});

/**
 * SEC-02: CORS whitelist — hanya origin yang terdaftar di CORS_ALLOWED_ORIGINS
 * yang boleh membaca respons /api/v1/* dari browser (mis. SPA/mobile-web
 * terpisah di masa depan). Request tanpa header Origin (curl, Postman, server-
 * to-server) tetap diizinkan — itu bukan skenario yang CORS lindungi (CORS
 * murni pertahanan sisi-browser, bukan gerbang autentikasi/otorisasi).
 */
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn(`[cors] Origin ditolak: ${origin}`);
    return callback(new ForbiddenError('Origin tidak diizinkan oleh kebijakan CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = { cspNonce, helmetMiddleware, corsMiddleware };
