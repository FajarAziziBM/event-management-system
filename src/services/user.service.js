// src/services/user.service.js
'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const db = require('../models');
const config = require('../config/env');
const NotificationService = require('./notification.service');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

class UserService {
  /**
   * USR-01: List user + pagination + search (nama/email) + filter role opsional
   */
  static async listUsers({ page, limit, search, role } = {}) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await db.User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    return {
      users: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: count,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  static async getUserById(id) {
    const user = await db.User.findByPk(id, { attributes: { exclude: ['password'] } });
    if (!user) {
      throw new NotFoundError('User tidak ditemukan');
    }
    return user;
  }

  /**
   * USR-02: Admin buat user baru dengan role APA PUN (beda dari AUTH-01
   * yang selalu default 'customer')
   */
  static async createUser({ name, email, password, role, phone }) {
    const existing = await db.User.findOne({ where: { email } });
    if (existing) {
      throw new ValidationError('Email sudah digunakan', { email: 'Email sudah digunakan' });
    }

    const hashedPassword = await bcrypt.hash(password, config.auth.bcryptSaltRounds);
    const user = await db.User.create({ name, email, password: hashedPassword, role, phone });

    // NOTIF-05: beri tahu admin LAIN (kalau ada lebih dari satu) bahwa ada organizer baru
    if (role === 'organizer') {
      await NotificationService.notifyAdminNewOrganizer(user);
    }

    return user.toSafeJSON();
  }

  /**
   * USR-03: Edit data user (bukan password/role/suspend — masing-masing
   * punya endpoint sendiri untuk audit trail & guard yang lebih jelas)
   */
  static async updateUser(id, { name, email, phone, avatar }) {
    const user = await db.User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User tidak ditemukan');
    }

    if (email && email !== user.email) {
      const existing = await db.User.findOne({ where: { email } });
      if (existing) {
        throw new ValidationError('Email sudah digunakan', { email: 'Email sudah digunakan' });
      }
    }

    await user.update({
      name: name ?? user.name,
      email: email ?? user.email,
      phone: phone !== undefined ? phone : user.phone,
      avatar: avatar !== undefined ? avatar : user.avatar,
    });

    return user.toSafeJSON();
  }

  /**
   * USR-04: Hapus user — guard: tidak bisa hapus diri sendiri, tidak bisa
   * hapus satu-satunya admin tersisa, dan FK RESTRICT (masih punya
   * event/order) ditangkap jadi pesan yang jelas.
   */
  static async deleteUser(id, requestingAdminId) {
    if (String(id) === String(requestingAdminId)) {
      throw new ValidationError('Anda tidak bisa menghapus akun Anda sendiri');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User tidak ditemukan');
    }

    if (user.role === 'admin') {
      const adminCount = await db.User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new ConflictError('Tidak bisa menghapus satu-satunya admin yang tersisa');
      }
    }

    try {
      await user.destroy();
    } catch (err) {
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        throw new ConflictError(
          'User tidak bisa dihapus karena masih memiliki event atau order terkait',
        );
      }
      throw err;
    }

    return { id: user.id, name: user.name };
  }

  /**
   * USR-05: Ubah role — guard: tidak bisa ubah role diri sendiri, tidak bisa
   * menurunkan role satu-satunya admin tersisa (mencegah platform kehabisan admin).
   * Efeknya LANGSUNG berlaku di request berikutnya (lihat auth.middleware.js).
   */
  static async changeRole(id, newRole, requestingAdminId) {
    if (String(id) === String(requestingAdminId)) {
      throw new ValidationError('Anda tidak bisa mengubah role akun Anda sendiri');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User tidak ditemukan');
    }

    if (user.role === 'admin' && newRole !== 'admin') {
      const adminCount = await db.User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new ConflictError('Tidak bisa mengubah role satu-satunya admin yang tersisa');
      }
    }

    const wasOrganizerBefore = user.role === 'organizer';
    await user.update({ role: newRole });

    // NOTIF-05: baru jadi organizer (bukan yang SUDAH organizer sebelumnya)
    if (newRole === 'organizer' && !wasOrganizerBefore) {
      await NotificationService.notifyAdminNewOrganizer(user);
    }
    return user.toSafeJSON();
  }

  /**
   * USR-06: Suspend/aktifkan — guard sama seperti changeRole (tidak bisa
   * suspend diri sendiri / satu-satunya admin aktif). Efeknya LANGSUNG
   * berlaku di request berikutnya (lihat auth.middleware.js), tidak menunggu
   * token lama expired.
   */
  static async toggleSuspend(id, isSuspended, requestingAdminId) {
    if (String(id) === String(requestingAdminId)) {
      throw new ValidationError('Anda tidak bisa suspend akun Anda sendiri');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User tidak ditemukan');
    }

    if (user.role === 'admin' && isSuspended) {
      const activeAdminCount = await db.User.count({
        where: { role: 'admin', isSuspended: false },
      });
      if (activeAdminCount <= 1) {
        throw new ConflictError('Tidak bisa suspend satu-satunya admin yang aktif');
      }
    }

    await user.update({ isSuspended });
    return user.toSafeJSON();
  }
}

module.exports = UserService;
