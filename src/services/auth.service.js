// services/auth.service.js

'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { User } = require('../models');
const { ConflictError, UnauthorizedError } = require('../utils/errors');

const config = require('../config/env');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;


class AuthService {

  static async register({ name, email, password, phone }) {

    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('Email already exists');
    }


    const hashedPassword = await bcrypt.hash(
      password,
      SALT_ROUNDS
    );


    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'customer',
    });


    return user.toSafeJSON();
  }


  static async login({ email, password }) {

    const user = await User.findOne({
      where: { email },
    });


    if (!user) {
      throw new UnauthorizedError(
        'Invalid email or password'
      );
    }


    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );


    if (!passwordMatch) {
      throw new UnauthorizedError(
        'Invalid email or password'
      );
    }


    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.auth.jwtSecret,
      {
        expiresIn: config.auth.jwtExpiresIn,
      }
    );


    return {
      token,
      user: user.toSafeJSON(),
    };
  }

}


module.exports = AuthService;
