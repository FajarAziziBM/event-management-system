// services/auth.service.js

'use strict';

const bcrypt = require('bcrypt');
const { User } = require('../models');
const { ConflictError } = require('../utils/errors');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

class AuthService {
  /**
   * Register customer baru
   * @param {Object} payload
   * @param {string} payload.name
   * @param {string} payload.email
   * @param {string} payload.password
   * @param {string} [payload.phone]
   * @returns {Promise<Object>}
   */
  static async register({ name, email, password, phone }) {
    // Cek email sudah digunakan atau belum
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Simpan user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'customer', // paksa customer
    });

    // Kembalikan data tanpa password
    return user.toSafeJSON();
  }
}

module.exports = AuthService;
