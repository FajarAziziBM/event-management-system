// src/validations/auth.validation.js
'use strict';

const { body, validationResult } = require('express-validator');

const { ValidationError } = require('../utils/errors');

/**
 * Middleware untuk jalankan validasi & lempar error jika ada
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMap = {};
    errors.array().forEach((err) => {
      if (!errorMap[err.path]) {
        errorMap[err.path] = err.msg;
      }
    });
    return next(new ValidationError('Validasi input gagal', errorMap));
  }
  next();
}

/**
 * Validasi register — name, email, password
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nama wajib diisi')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nama harus 3-100 karakter'),
  body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi')
    .isLength({ min: 8 })
    .withMessage('Password minimal 8 karakter')
    .matches(/[A-Z]/)
    .withMessage('Password harus mengandung huruf besar')
    .matches(/[a-z]/)
    .withMessage('Password harus mengandung huruf kecil')
    .matches(/[0-9]/)
    .withMessage('Password harus mengandung angka'),
  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Konfirmasi password tidak cocok'),
  handleValidationErrors,
];

/**
 * Validasi login — email, password
 */
const validateLogin = [
  body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  body('password').notEmpty().withMessage('Password wajib diisi'),
  handleValidationErrors,
];

/**
 * Validasi forgot password — email
 */
const validateForgotPassword = [
  body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  handleValidationErrors,
];

/**
 * Validasi reset password — newPassword, newPasswordConfirm
 */
const validateResetPassword = [
  body('newPassword')
    .notEmpty()
    .withMessage('Password baru wajib diisi')
    .isLength({ min: 8 })
    .withMessage('Password minimal 8 karakter')
    .matches(/[A-Z]/)
    .withMessage('Password harus mengandung huruf besar')
    .matches(/[a-z]/)
    .withMessage('Password harus mengandung huruf kecil')
    .matches(/[0-9]/)
    .withMessage('Password harus mengandung angka'),
  body('newPasswordConfirm')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Konfirmasi password tidak cocok'),
  handleValidationErrors,
];

/**
 * Validasi change password — oldPassword, newPassword
 */
const validateChangePassword = [
  body('oldPassword').notEmpty().withMessage('Password lama wajib diisi'),
  body('newPassword')
    .notEmpty()
    .withMessage('Password baru wajib diisi')
    .isLength({ min: 8 })
    .withMessage('Password minimal 8 karakter')
    .matches(/[A-Z]/)
    .withMessage('Password harus mengandung huruf besar')
    .matches(/[a-z]/)
    .withMessage('Password harus mengandung huruf kecil')
    .matches(/[0-9]/)
    .withMessage('Password harus mengandung angka')
    .custom((value, { req }) => value !== req.body.oldPassword)
    .withMessage('Password baru tidak boleh sama dengan password lama'),
  body('newPasswordConfirm')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Konfirmasi password tidak cocok'),
  handleValidationErrors,
];

/**
 * Validasi update profile — name, phone
 */
const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nama harus 3-100 karakter'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Nomor telepon tidak valid'),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateUpdateProfile,
};
