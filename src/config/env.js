// src/config/env.js
'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

/**
 * Load environment sesuai mode aplikasi:
 *
 * development / production:
 *   membaca .env
 *
 * test:
 *   membaca .env.test
 *
 * Contoh:
 * NODE_ENV=test npm test
 *        ↓
 * .env.test
 */
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

/**
 * Ambil environment variable yang WAJIB ada.
 *
 * Development & production:
 *   jika kosong -> throw error
 *
 * Test:
 *   boleh kosong agar test tidak bergantung pada secret asli
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
  if (value === undefined) {
    return fallback;
  }

  return value === 'true' || value === '1';
}

function toList(value, fallback = []) {
  if (!value) {
    return fallback;
  }

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

    /**
     * Contoh:
     *
     * .env
     * DB_NAME=ems_db
     *
     * test database:
     * database.js
     * ems_db_test
     */
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

  /**
   * SEC-03: hop count reverse proxy di depan app (nginx, load balancer, dst).
   * 0 = tidak ada proxy, percaya req.socket.remoteAddress apa adanya (default,
   * aman untuk local dev). Kalau di-deploy di belakang 1 reverse proxy, set
   * TRUST_PROXY=1 supaya req.ip baca header X-Forwarded-For dgn benar —
   * WAJIB diisi sesuai topologi asli, jangan asal 'true' (blind trust bikin
   * X-Forwarded-For gampang dipalsukan untuk membypass rate limiting).
   */
  trustProxy: toInt(process.env.TRUST_PROXY, 0),

  order: {
    expiryMinutes: toInt(process.env.ORDER_EXPIRY_MINUTES, 60),

    /**
     * Persentase biaya layanan
     * implementasi ORD-03
     */
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

  /**
   * CICD-07: error tracking (Sentry) — SEPENUHNYA opsional. Kosongkan
   * SENTRY_DSN utk menonaktifkan total (default) — lihat src/instrument.js.
   * tracesSampleRate rendah by default: performance tracing Sentry dihitung
   * per-transaksi di sebagian besar paket harga, sengaja konservatif.
   */
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || null,
    sentryTracesSampleRate: toInt(process.env.SENTRY_TRACES_SAMPLE_RATE_PERCENT, 0) / 100,
  },
};

/**
 * SEC-08: cegah aplikasi jalan di production dengan secret yang masih nilai
 * contoh dari .env.example, atau yang terlalu pendek untuk aman di-brute-force.
 * Sengaja HANYA di production — di development/test, secret contoh yang
 * pendek itu wajar & tidak boleh menghalangi orang baru clone & langsung coba.
 */
const WEAK_SECRET_PATTERNS = [/^replace_with/i, /^secret$/i, /^changeme$/i, /^12345/];
const MIN_SECRET_LENGTH = 32;

function assertStrongSecret(name, value) {
  if (nodeEnv !== 'production') return;

  if (!value || value.length < MIN_SECRET_LENGTH || WEAK_SECRET_PATTERNS.some((re) => re.test(value))) {
    throw new Error(
      `${name} terlihat seperti nilai contoh/lemah (panjang < ${MIN_SECRET_LENGTH} karakter atau ` +
        `masih placeholder). Generate nilai acak sungguhan sebelum deploy ke production, ` +
        `contoh: \`openssl rand -hex 32\`.`,
    );
  }
}

assertStrongSecret('JWT_SECRET', config.auth.jwtSecret);
assertStrongSecret('COOKIE_SECRET', config.auth.cookieSecret);
assertStrongSecret('CSRF_SECRET', config.auth.csrfSecret);

module.exports = config;
