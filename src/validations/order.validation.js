// src/validations/order.validation.js
'use strict';

const { body, param, validationResult } = require('express-validator');

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

const validateCreateOrder = [
  body('eventId').isInt({ min: 1 }).withMessage('eventId wajib diisi dan valid'),
  body('quantity').isInt({ min: 1 }).withMessage('quantity wajib angka positif minimal 1'),
  handleValidationErrors,
];

const validateOrderId = [
  param('id').isInt({ min: 1 }).withMessage('ID order tidak valid'),
  handleValidationErrors,
];

module.exports = { validateCreateOrder, validateOrderId };
