// src/middlewares/webAuth.middleware.js
'use strict';

const { setFlash } = require('../utils/flash');

/**
 * Versi web dari `authenticate`: req.user sudah diisi (atau tidak) oleh
 * authenticateOptional yang jalan global di app.js. Middleware ini hanya
 * menjaga rute — kalau belum login, REDIRECT ke /auth/login (bukan lempar
 * 401 yang berujung ke halaman error generik seperti authenticate() versi API).
 */
function requireWebAuth(req, res, next) {
  if (!req.user) {
    setFlash(res, 'error', 'Silakan login terlebih dahulu untuk mengakses halaman ini.');
    return res.redirect(`/auth/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  return next();
}

/**
 * Versi web dari `authorize(...roles)`: render halaman error 403 yang rapi,
 * bukan JSON. Pasang SETELAH requireWebAuth.
 */
function requireWebRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).render('errors/error', {
        title: 'Akses Ditolak',
        statusCode: 403,
        message: 'Anda tidak memiliki akses ke halaman ini.',
      });
    }
    return next();
  };
}

module.exports = { requireWebAuth, requireWebRole };
