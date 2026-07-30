// src/middlewares/rateLimiter.middleware.js
'use strict';

const rateLimit = require('express-rate-limit');

const config = require('../config/env');
const logger = require('../config/logger');
const ApiResponse = require('../utils/ApiResponse');
const { setFlash } = require('../utils/flash');

/**
 * Rate limiting itu proteksi terhadap ABUSE, bukan bagian dari correctness
 * yang mau diuji test suite — kalau tetap aktif, 11 file test yang jalan
 * --runInBand berbagi SATU in-memory store proses yang sama, jadi mudah
 * kena limit hanya karena banyak test memanggil /auth/login berturutan,
 * bukan karena ada bug. Maka: no-op di NODE_ENV=test.
 */
const isTestEnv = config.isTest;
function passthrough(req, res, next) {
  next();
}

/**
 * SEC-03: limiter umum untuk seluruh /api/v1/* — jaring pengaman terhadap
 * scraping/abuse volumetrik biasa. Angka dari config (RATE_LIMIT_WINDOW_MS/MAX),
 * jadi bisa disetel per-environment tanpa ubah kode.
 */
const generalApiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      `[rate-limit:api] IP ${req.ip} melebihi batas pada ${req.method} ${req.originalUrl}`,
    );
    res
      .status(429)
      .json(ApiResponse.error('Terlalu banyak permintaan, coba lagi beberapa saat lagi.'));
  },
});

/**
 * SEC-03: limiter ketat khusus endpoint sensitif (login, register, forgot-
 * password, reset-password, change-password). SATU instance ini sengaja
 * dipakai bersama oleh versi web (EJS) maupun API dari endpoint yang sama
 * (mis. POST /auth/login DAN POST /api/v1/auth/login berbagi limiter yang
 * sama) — supaya penyerang tidak bisa menggandakan jatah percobaan hanya
 * dengan pindah dari satu permukaan ke permukaan lain. Dihitung per-IP,
 * hanya percobaan yang GAGAL yang mengurangi jatah (login yang berhasil
 * tidak menghukum user sah yang memang sering login).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(
      `[rate-limit:auth] IP ${req.ip} melebihi batas pada ${req.method} ${req.originalUrl}`,
    );
    const message = 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.';
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(429).json(ApiResponse.error(message));
    }
    setFlash(res, 'error', message);
    return res.redirect(req.get('Referer') || '/');
  },
});

/**
 * SEC-03: limiter untuk webhook Xendit. Jauh lebih longgar daripada authLimiter
 * (Xendit bisa mengirim banyak event sekaligus saat traffic pembayaran tinggi
 * atau saat retry) — tujuannya semata mencegah flood/DoS ke endpoint ini,
 * BUKAN membatasi traffic Xendit yang sah. Verifikasi keaslian request tetap
 * jadi tanggung jawab verifyXenditWebhook (x-callback-token), bukan limiter ini.
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`[rate-limit:webhook] IP ${req.ip} melebihi batas webhook`);
    res
      .status(429)
      .json(ApiResponse.error('Terlalu banyak permintaan webhook, coba lagi sesaat lagi.'));
  },
});

module.exports = isTestEnv
  ? { generalApiLimiter: passthrough, authLimiter: passthrough, webhookLimiter: passthrough }
  : { generalApiLimiter, authLimiter, webhookLimiter };
