// src/routes/web/auth.js
'use strict';

const express = require('express');

const AuthWebController = require('../../controllers/web/auth.controller');
const { authenticateOptional } = require('../../middlewares/auth.middleware');
const { requireWebAuth } = require('../../middlewares/webAuth.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter.middleware');
const { requireCsrf } = require('../../middlewares/csrf.middleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateUpdateProfile,
} = require('../../validations/auth.validation');

const router = express.Router();

// GET halaman (tidak perlu validasi, hanya render form)
router.get('/register', AuthWebController.getRegister);
router.get('/login', authenticateOptional, AuthWebController.getLogin);
router.get('/forgot-password', AuthWebController.getForgotPassword);
router.get('/reset-password', AuthWebController.getResetPassword);
router.get('/profile', requireWebAuth, AuthWebController.getProfile);

// POST proses — urutan middleware: rate-limit -> CSRF -> validasi input -> controller
// SEC-03: authLimiter di endpoint rawan brute-force/spam. Instance yang SAMA
// juga dipasang di routes/api/v1/auth.js, supaya percobaan di web & API
// terhitung dalam jatah yang sama per-IP.
// SEC-06: requireCsrf di SETIAP form POST web (tidak berlaku utk /api/v1/*).
router.post(
  '/register',
  authLimiter,
  requireCsrf,
  validateRegister,
  AuthWebController.postRegister,
);
router.post('/login', authLimiter, requireCsrf, validateLogin, AuthWebController.postLogin);
router.post('/logout', requireCsrf, AuthWebController.logout);
router.post(
  '/forgot-password',
  authLimiter,
  requireCsrf,
  validateForgotPassword,
  AuthWebController.postForgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  requireCsrf,
  validateResetPassword,
  AuthWebController.postResetPassword,
);
router.post(
  '/profile',
  requireWebAuth,
  requireCsrf,
  validateUpdateProfile,
  AuthWebController.postProfile,
);
router.post(
  '/change-password',
  requireWebAuth,
  authLimiter,
  requireCsrf,
  validateChangePassword,
  AuthWebController.postChangePassword,
);

module.exports = router;
