// src/routes/api/v1/auth.js
'use strict';

const express = require('express');

const AuthController = require('../../../controllers/api/v1/auth.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const { authLimiter } = require('../../../middlewares/rateLimiter.middleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateUpdateProfile,
} = require('../../../validations/auth.validation');

const router = express.Router();

// Public routes (tidak perlu login)
router.post('/register', authLimiter, validateRegister, AuthController.register);
router.post('/login', authLimiter, validateLogin, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', authLimiter, validateForgotPassword, AuthController.forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, AuthController.resetPassword);

// Protected routes (perlu login)
router.get('/me', authenticate, AuthController.getMe);
router.patch('/profile', authenticate, validateUpdateProfile, AuthController.updateProfile);
router.patch(
  '/change-password',
  authenticate,
  authLimiter,
  validateChangePassword,
  AuthController.changePassword,
);

module.exports = router;
