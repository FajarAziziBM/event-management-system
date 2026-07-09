// controllers/api/v1/auth.controller.js

'use strict';

const AuthService = require('../../../services/auth.service');
const ApiResponse = require('../../../utils/apiResponse');

class AuthController {
  static async register(req, res, next) {
    try {
      const user = await AuthService.register(req.body);

      return res.status(201).json(
        ApiResponse.success(
          'User registered successfully',
          user,
        ),
      );
    } catch (error) {
      return next(error);
    }
  }

  static async login(req, res, next) {
    try {

      const { token, user } =
        await AuthService.login(req.body);


      res.cookie(
        'token',
        token,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        }
      );


      return res.status(200).json(
        ApiResponse.success(
          'Login successful',
          user
        )
      );


    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return res.status(200).json(
        ApiResponse.success(
          'Logout successful',
          null
        )
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
