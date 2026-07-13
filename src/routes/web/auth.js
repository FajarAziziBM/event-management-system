// src/routes/web/auth.js
'use strict';

const express = require('express');

const AuthWebController = require('../../controllers/web/auth.controller');
const { authenticate, authenticateOptional } = require('../../middlewares/auth.middleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../../validations/auth.validation');

const router = express.Router();

// GET halaman (tidak perlu validasi, hanya render form)
router.get('/register', AuthWebController.getRegister);
router.get('/login', authenticateOptional, AuthWebController.getLogin);
router.get('/forgot-password', AuthWebController.getForgotPassword);
router.get('/reset-password', AuthWebController.getResetPassword);
router.get('/profile', authenticate, AuthWebController.getProfile);

// POST proses
router.post('/register', validateRegister, AuthWebController.postRegister);
router.post('/login', validateLogin, AuthWebController.postLogin);
router.post('/logout', AuthWebController.logout);
router.post('/forgot-password', validateForgotPassword, AuthWebController.postForgotPassword);
router.post('/reset-password', validateResetPassword, AuthWebController.postResetPassword);

module.exports = router;
