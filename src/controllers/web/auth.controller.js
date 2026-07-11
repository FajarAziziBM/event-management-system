// controllers/web/auth.controller.js

'use strict';

const AuthService = require('../../services/auth.service');
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
   */
  static async postRegister(req, res, _next) {
    try {
      const { name, email, password } = req.body;
      await AuthService.register(name, email, password);

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
    res.render('auth/login', { title: 'Masuk' });
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      setFlash(res, 'success', `Selamat datang kembali, ${user.name}!`);
      res.redirect('/');
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
   * GET /auth/profile — halaman profil (belum dibuat di epic ini, jatuh ke epic user)
   */
  static getProfile(req, res) {
    res.render('auth/profile', { title: 'Profil Saya', user: req.user });
  }
}

module.exports = AuthWebController;
