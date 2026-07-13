// src/config/env.js
'use strict';

const path = require('node:path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Ambil environment variable yang WAJIB ada. Selalu throw di development &
 * production supaya aplikasi gagal cepat (fail fast) bila .env belum lengkap.
 * Di NODE_ENV=test, validasi dilonggarkan agar test tidak butuh .env penuh.
 */
function required(name) {
  const value = process.env[name];
  const isMissing = value === undefined || value === '';

  if (isMissing && process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Missing required environment variable: ${name}. Sudah copy .env.example ke .env?`,
    );
  }

  return isMissing ? undefined : value;
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function toList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',

  app: {
    port: toInt(process.env.PORT, 3000),
    url: process.env.APP_URL || 'http://localhost:3000',
    timezone: process.env.TZ || 'Asia/Jakarta',
  },

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || 'ems_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    cookieSecret: required('COOKIE_SECRET'),
    cookieSecure: toBool(process.env.COOKIE_SECURE, false),
    csrfSecret: required('CSRF_SECRET'),
    bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 12),
  },

  cors: {
    allowedOrigins: toList(process.env.CORS_ALLOWED_ORIGINS, ['http://localhost:3000']),
  },

  order: {
    expiryMinutes: toInt(process.env.ORDER_EXPIRY_MINUTES, 60),
    // Persentase biaya layanan dari subtotal — bukan bagian spesifikasi asli,
    // keputusan desain saat implementasi ORD-03 (lihat catatan Epic ORD).
    serviceFeePercentage: toInt(process.env.SERVICE_FEE_PERCENTAGE, 2),
  },

  xendit: {
    secretKey: required('XENDIT_SECRET_KEY'),
    callbackToken: required('XENDIT_CALLBACK_TOKEN'),
    successRedirectUrl: process.env.XENDIT_SUCCESS_REDIRECT_URL,
    failureRedirectUrl: process.env.XENDIT_FAILURE_REDIRECT_URL,
  },

  mail: {
    host: process.env.MAIL_HOST,
    port: toInt(process.env.MAIL_PORT, 587),
    username: process.env.MAIL_USERNAME,
    password: process.env.MAIL_PASSWORD,
    fromAddress: process.env.MAIL_FROM_ADDRESS || 'no-reply@example.com',
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 100),
  },

  upload: {
    dir: process.env.UPLOAD_DIR || 'src/public/uploads',
    maxFileSizeMb: toInt(process.env.UPLOAD_MAX_FILE_SIZE_MB, 5),
  },

  log: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};

module.exports = config;
