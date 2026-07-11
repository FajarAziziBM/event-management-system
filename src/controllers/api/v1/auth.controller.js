// controllers/api/v1/auth.controller.js

'use strict';

const AuthService = require('../../../services/auth.service');
const ApiResponse = require('../../../utils/ApiResponse');
const config = require('../../../config/env');

class AuthController {
  /**
   * AUTH-01: POST /api/v1/auth/register
   */
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const user = await AuthService.register(name, email, password);

      res.status(201).json(ApiResponse.success('Registrasi berhasil', user));
    } catch (err) {
      next(err);
    }
  }

  /**
   * AUTH-02: POST /api/v1/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);

      // Set token ke httpOnly cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.auth.cookieSecure,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 1 hari
      });

      res.json(ApiResponse.success('Login berhasil', { user, token }));
    } catch (err) {
      next(err);
    }
  }

  /**
   * AUTH-03: POST /api/v1/auth/logout
   */
  static logout(req, res) {
    res.clearCookie('token');
    res.json(ApiResponse.success('Logout berhasil'));
  }

  /**
   * AUTH-04: POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);
      res.json(ApiResponse.success(result.message));
    } catch (err) {
      next(err);
    }
  }

  /**
   * AUTH-05: POST /api/v1/auth/reset-password
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await AuthService.resetPassword(token, newPassword);
      res.json(ApiResponse.success(result.message));
    } catch (err) {
      next(err);
    }
  }

  /**
   * AUTH-06: PATCH /api/v1/auth/profile
   */
  static async updateProfile(req, res, next) {
    try {
      const { name, phone } = req.body;
      const user = await AuthService.updateProfile(req.user.id, { name, phone });
      res.json(ApiResponse.success('Profil berhasil diperbarui', user));
    } catch (err) {
      next(err);
    }
  }

  /**
   * AUTH-07: PATCH /api/v1/auth/change-password
   */
  static async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(req.user.id, { oldPassword, newPassword });
      res.json(ApiResponse.success(result.message));
    } catch (err) {
      next(err);
    }
  }

  /**
   * AUTH-08: GET /api/v1/auth/me — ambil profil user yang login
   */
  static async getMe(req, res, next) {
    try {
      const db = require('../../../models');
      const user = await db.User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        return next(new Error('User tidak ditemukan'));
      }

      res.json(ApiResponse.success('OK', user.toJSON()));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
