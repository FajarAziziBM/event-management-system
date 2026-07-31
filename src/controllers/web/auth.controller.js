// src/controllers/web/auth.controller.js
'use strict';

const AuthService = require('../../services/auth.service');
const UserService = require('../../services/user.service');
const OrderService = require('../../services/order.service');
const EventService = require('../../services/event.service');
const config = require('../../config/env');
const { setFlash } = require('../../utils/flash');

class AuthWebController {
  /**
   * GET /auth/register — halaman form register
   */
  static getRegister(req, res) {
    res.render('auth/register', { title: 'Daftar Akun' });
  }

  /**
   * POST /auth/register — proses registrasi, redirect ke login dengan flash
   * Catatan: role di-whitelist ke 'customer'/'organizer' saja — AuthService.register
   * sendiri tidak membatasi role apa yang boleh dikirim, jadi penjagaan dilakukan
   * di sini supaya form register tidak bisa dipakai untuk membuat akun admin.
   */
  static async postRegister(req, res, _next) {
    try {
      const { name, email, password } = req.body;
      const role = req.body.role === 'organizer' ? 'organizer' : 'customer';
      await AuthService.register(name, email, password, role);

      setFlash(res, 'success', 'Registrasi berhasil! Silakan login dengan akun Anda.');
      res.redirect('/auth/login');
    } catch (err) {
      // Jika error, re-render form dengan pesan error di flash
      setFlash(res, 'error', err.message || 'Terjadi kesalahan saat registrasi');
      res.redirect('/auth/register');
      // Bisa juga next(err) untuk global error handler, tapi UX lebih baik redirect ke form
    }
  }

  /**
   * GET /auth/login — halaman form login
   */
  static getLogin(req, res) {
    // Jika sudah login, redirect ke home
    if (req.user) {
      return res.redirect('/');
    }
    res.render('auth/login', { title: 'Masuk', redirect: req.query.redirect || '' });
  }

  /** Hanya izinkan redirect ke path relatif sendiri (cegah open-redirect). */
  static _safeRedirect(target) {
    if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) {
      return target;
    }
    return '/';
  }

  /**
   * POST /auth/login — proses login
   */
  static async postLogin(req, res, _next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);

      // Set token ke httpOnly cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.auth.cookieSecure,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      setFlash(res, 'success', `Selamat datang kembali, ${user.name}!`);
      res.redirect(AuthWebController._safeRedirect(req.body.redirect));
    } catch (err) {
      setFlash(res, 'error', err.message || 'Email atau password salah');
      res.redirect('/auth/login');
    }
  }

  /**
   * GET /auth/logout — logout & redirect ke home
   */
  static logout(req, res) {
    res.clearCookie('token');
    setFlash(res, 'success', 'Logout berhasil');
    res.redirect('/');
  }

  /**
   * GET /auth/forgot-password — halaman form forgot password
   */
  static getForgotPassword(req, res) {
    res.render('auth/forgot-password', { title: 'Lupa Password' });
  }

  /**
   * POST /auth/forgot-password — proses forgot password
   */
  static async postForgotPassword(req, res, _next) {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);

      setFlash(res, 'success', result.message);
      res.redirect('/auth/login');
    } catch (err) {
      setFlash(res, 'error', err.message || 'Terjadi kesalahan');
      res.redirect('/auth/forgot-password');
    }
  }

  /**
   * GET /auth/reset-password?token=xxx — halaman form reset password
   */
  static getResetPassword(req, res) {
    const { token } = req.query;
    if (!token) {
      setFlash(res, 'error', 'Token tidak ditemukan');
      return res.redirect('/auth/login');
    }
    res.render('auth/reset-password', { title: 'Reset Password', token });
  }

  /**
   * POST /auth/reset-password — proses reset password
   */
  static async postResetPassword(req, res, _next) {
    try {
      const { token, newPassword } = req.body;
      const result = await AuthService.resetPassword(token, newPassword);

      setFlash(res, 'success', result.message);
      res.redirect('/auth/login');
    } catch (err) {
      setFlash(res, 'error', err.message || 'Gagal reset password');
      res.redirect(`/auth/reset-password?token=${req.body.token}`);
    }
  }

  /**
   * GET /auth/profile — halaman profil, dengan ringkasan statistik ringan
   * (jumlah pesanan untuk semua role, jumlah event untuk organizer/admin).
   */
  static async getProfile(req, res, next) {
    try {
      const [profileUser, { pagination: orderStats }] = await Promise.all([
        UserService.getUserById(req.user.id),
        OrderService.listMyOrders(req.user.id, { limit: 1 }),
      ]);
      let eventStats = null;
      if (req.user.role === 'organizer' || req.user.role === 'admin') {
        const { pagination } = await EventService.listEventsByCreator(req.user.id, { limit: 1 });
        eventStats = pagination.totalItems;
      }

      res.render('users/profile', {
        title: 'Profil Saya',
        profileUser,
        totalOrders: orderStats.totalItems,
        totalEvents: eventStats,
        errors: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /** POST /auth/profile — update nama & nomor telepon (validasi: lihat validateUpdateProfile di routes) */
  static async postProfile(req, res) {
    try {
      const name = (req.body.name || '').trim();
      const phone = (req.body.phone || '').trim();

      await AuthService.updateProfile(req.user.id, { name: name || undefined, phone: phone || null });
      setFlash(res, 'success', 'Profil berhasil diperbarui.');
      return res.redirect('/auth/profile');
    } catch (err) {
      setFlash(res, 'error', err.message || 'Gagal memperbarui profil');
      return res.redirect('/auth/profile');
    }
  }

  /** POST /auth/change-password (validasi: lihat validateChangePassword di routes) */
  static async postChangePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;

      await AuthService.changePassword(req.user.id, { oldPassword, newPassword });
      setFlash(res, 'success', 'Password berhasil diubah.');
      return res.redirect('/auth/profile');
    } catch (err) {
      setFlash(res, 'error', err.message || 'Gagal mengubah password');
      return res.redirect('/auth/profile');
    }
  }
}

module.exports = AuthWebController;
