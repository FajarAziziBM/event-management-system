// src/middlewares/auth.middleware.js
'use strict';

const AuthService = require('../services/auth.service');
const db = require('../models');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * AUTH-08: authenticate — verifikasi JWT dari cookie atau header Authorization
 * Attach req.user jika valid, lempar UnauthorizedError jika tidak
 *
 * USR-05/06: setelah JWT terverifikasi, role & status suspend diambil ULANG
 * dari DB (bukan dipercaya begitu saja dari klaim di dalam token) — supaya
 * perubahan role (USR-05) atau suspend (USR-06) oleh admin langsung berlaku
 * detik itu juga, tidak menunggu token lama expired (bisa sampai 1 hari).
 */
async function authenticate(req, res, next) {
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

    const user = await db.User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'isSuspended'],
    });

    if (!user) {
      return next(new UnauthorizedError('User tidak ditemukan'));
    }
    if (user.isSuspended) {
      return next(new ForbiddenError('Akun Anda telah disuspend, hubungi admin'));
    }

    req.user = { id: user.id, email: user.email, role: user.role };
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
 * Attach req.user jika ada token valid & user masih aktif, tapi jangan error
 * kalau tidak ada token / token invalid / user disuspend — cukup dianggap
 * anonymous (sesuai tujuan middleware ini: tidak pernah memblokir request).
 */
async function authenticateOptional(req, res, next) {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }

  if (token) {
    try {
      const decoded = AuthService.verifyAndDecodeToken(token);

      const user = await db.User.findByPk(decoded.id, {
        attributes: ['id', 'email', 'role', 'isSuspended'],
      });

      if (user && !user.isSuspended) {
        req.user = { id: user.id, email: user.email, role: user.role };
      }
    } catch {
      // Token invalid, tapi jangan error — hanya anggap sebagai unauthenticated
    }
  }

  next();
}

module.exports = { authenticate, authorize, authenticateOptional };
