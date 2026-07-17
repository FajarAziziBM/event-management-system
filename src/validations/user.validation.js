// src/validations/user.validation.js
'use strict';

const { body, param, query, validationResult } = require('express-validator');

const { ValidationError } = require('../utils/errors');

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

const ROLES = ['admin', 'organizer', 'customer'];

const validateListUsersQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role')
    .optional()
    .isIn(ROLES)
    .withMessage(`role harus salah satu dari: ${ROLES.join(', ')}`),
  handleValidationErrors,
];

const validateUserId = [
  param('id').isInt({ min: 1 }).withMessage('ID user tidak valid'),
  handleValidationErrors,
];

const validateCreateUser = [
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
  body('role')
    .isIn(ROLES)
    .withMessage(`role harus salah satu dari: ${ROLES.join(', ')}`),
  body('phone').optional({ nullable: true }).trim(),
  handleValidationErrors,
];

const validateUpdateUser = [
  param('id').isInt({ min: 1 }).withMessage('ID user tidak valid'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nama tidak boleh kosong')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nama harus 3-100 karakter'),
  body('email').optional().trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  body('phone').optional({ nullable: true }).trim(),
  handleValidationErrors,
];

const validateChangeRole = [
  param('id').isInt({ min: 1 }).withMessage('ID user tidak valid'),
  body('role')
    .isIn(ROLES)
    .withMessage(`role harus salah satu dari: ${ROLES.join(', ')}`),
  handleValidationErrors,
];

const validateSuspend = [
  param('id').isInt({ min: 1 }).withMessage('ID user tidak valid'),
  body('isSuspended').isBoolean().withMessage('isSuspended harus true/false'),
  handleValidationErrors,
];

module.exports = {
  validateListUsersQuery,
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
  validateChangeRole,
  validateSuspend,
};
