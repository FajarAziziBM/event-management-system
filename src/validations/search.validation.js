// src/validations/search.validation.js
'use strict';

const { query, validationResult } = require('express-validator');

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

const ORDER_STATUSES = ['pending', 'paid', 'expired', 'cancelled', 'refunded'];

const validateSearchOrdersQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status')
    .optional()
    .isIn(ORDER_STATUSES)
    .withMessage(`status harus salah satu dari: ${ORDER_STATUSES.join(', ')}`),
  query('eventId').optional().isInt({ min: 1 }),
  handleValidationErrors,
];

const validateSearchTicketsQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('isCheckedIn').optional().isBoolean().withMessage('isCheckedIn harus true/false'),
  query('eventId').optional().isInt({ min: 1 }),
  handleValidationErrors,
];

const validateSearchAllQuery = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Query pencarian (q) wajib diisi')
    .isLength({ min: 2 })
    .withMessage('Query pencarian minimal 2 karakter'),
  handleValidationErrors,
];

module.exports = {
  validateSearchOrdersQuery,
  validateSearchTicketsQuery,
  validateSearchAllQuery,
};
