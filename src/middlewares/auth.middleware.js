'use strict';

const AuthService = require('../services/auth.service');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * AUTH-08: authenticate — verifikasi JWT dari cookie atau header Authorization
 * Attach req.user jika valid, lempar UnauthorizedError jika tidak
 */
function authenticate(req, res, next) {
  let token;

  // Cek cookie dulu (untuk EJS halaman), fallback ke header Authorization (untuk API clients)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }

  if (!token) {
    return next(new UnauthorizedError('Token tidak ditemukan'));
  }

  try {
    const decoded = AuthService.verifyAndDecodeToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * AUTH-09: authorize(...roles) — RBAC, cek apakah user role termasuk dalam roles yang diizinkan
 * Gunakan setelah authenticate, misal: router.post('/admin-only', authenticate, authorize('admin'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('User tidak ditemukan'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Anda tidak memiliki akses. Hanya ${allowedRoles.join(', ')} yang diizinkan`,
        ),
      );
    }

    next();
  };
}

/**
 * Optional middleware untuk endpoint yang boleh diakses authenticated atau tidak
 * Attach req.user jika ada token valid, tapi jangan error jika tidak ada token
 */
function authenticateOptional(req, res, next) {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }

  if (token) {
    try {
      const decoded = AuthService.verifyAndDecodeToken(token);
      req.user = decoded;
    } catch {
      // Token invalid, tapi jangan error — hanya anggap sebagai unauthenticated
    }
  }

  next();
}

module.exports = { authenticate, authorize, authenticateOptional };
