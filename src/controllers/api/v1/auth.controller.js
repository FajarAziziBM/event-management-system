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
}

module.exports = AuthController;
