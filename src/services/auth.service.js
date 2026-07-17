// src/services/auth.service.js
'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const config = require('../config/env');
const { UnauthorizedError, ForbiddenError, ValidationError } = require('../utils/errors');
const db = require('../models');

class AuthService {
  /**
   * AUTH-01: Registrasi user baru (role default: 'customer')
   */
  static async register(name, email, password, role = 'customer') {
    // Validasi keberadaan user
    const existingUser = await db.User.findOne({ where: { email } });
    if (existingUser) {
      throw new ValidationError('Email sudah terdaftar', { field: 'email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.auth.bcryptSaltRounds);

    // Buat user baru
    const user = await db.User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    return user.toSafeJSON();
  }

  /**
   * AUTH-02: Login — return JWT token (dipasang di cookie httpOnly)
   */
  static async login(email, password) {
    const user = await db.User.findOne({ where: { email } });

    if (!user || !(await this.validatePassword(password, user.password))) {
      throw new UnauthorizedError('Email atau password salah');
    }

    // USR-06: cek suspend SETELAH password tervalidasi (bukan sebelum) —
    // supaya status suspend tidak bocor ke orang yang bahkan tidak tahu
    // password akun ini; hanya yang memang punya kredensial benar yang
    // mendapat pesan spesifik "akun disuspend".
    if (user.isSuspended) {
      throw new ForbiddenError('Akun Anda telah disuspend, hubungi admin');
    }

    const token = this.generateToken(user);
    return { user: user.toSafeJSON(), token };
  }

  /**
   * AUTH-04: Forgot password — generate reset token & kirim email (email via NOTIF-04 di epic NOTIF)
   */
  static async forgotPassword(email) {
    const user = await db.User.findOne({ where: { email } });

    if (!user) {
      // Jangan reveal apakah email ada atau tidak (security best practice)
      // Tapi tetap return success supaya attacker tidak bisa enumerate email
      return { success: true, message: 'Jika email terdaftar, reset link sudah dikirim' };
    }

    // Generate reset token (berlaku 1 jam)
    const _resetToken = jwt.sign({ userId: user.id, type: 'reset' }, config.auth.jwtSecret, {
      expiresIn: '1h',
    });

    // TODO (Epic NOTIF): kirim email ke user.email dengan link:
    // ${config.app.url}/auth/reset-password?token=${resetToken}

    return { success: true, message: 'Jika email terdaftar, reset link sudah dikirim' };
  }

  /**
   * AUTH-05: Reset password via token
   */
  static async resetPassword(token, newPassword) {
    let decoded;

    try {
      decoded = jwt.verify(token, config.auth.jwtSecret);
    } catch {
      throw new UnauthorizedError('Token reset password tidak valid atau sudah expired');
    }

    if (decoded.type !== 'reset') {
      throw new UnauthorizedError('Token tidak valid');
    }

    const user = await db.User.findByPk(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('User tidak ditemukan');
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.auth.bcryptSaltRounds);
    await user.update({ password: hashedPassword });

    return { success: true, message: 'Password berhasil direset' };
  }

  /**
   * AUTH-08: Middleware authenticate — validasi JWT dari cookie/header
   * Dipanggil dari middleware, bukan service, tapi helper ada di sini
   */
  static verifyAndDecodeToken(token) {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      return decoded;
    } catch {
      throw new UnauthorizedError('Token tidak valid atau sudah expired');
    }
  }

  /**
   * Generate JWT token
   */
  static generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn },
    );
  }

  /**
   * Validasi password plain vs hashed
   */
  static async validatePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * AUTH-06: Update profil user
   */
  static async updateProfile(userId, { name, phone, avatar }) {
    const user = await db.User.findByPk(userId);
    if (!user) {
      throw new UnauthorizedError('User tidak ditemukan');
    }

    await user.update({ name, phone, avatar });
    return user.toSafeJSON();
  }

  /**
   * AUTH-07: Change password — butuh password lama untuk verifikasi
   */
  static async changePassword(userId, { oldPassword, newPassword }) {
    const user = await db.User.findByPk(userId);
    if (!user) {
      throw new UnauthorizedError('User tidak ditemukan');
    }

    const passwordValid = await this.validatePassword(oldPassword, user.password);
    if (!passwordValid) {
      throw new ValidationError('Password lama salah', { field: 'oldPassword' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.auth.bcryptSaltRounds);
    await user.update({ password: hashedPassword });

    return { success: true, message: 'Password berhasil diubah' };
  }
}

module.exports = AuthService;
