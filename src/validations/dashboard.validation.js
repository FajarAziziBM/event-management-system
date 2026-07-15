// src/validations/dashboard.validation.js
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

const validateDateRangeQuery = [
  query('startDate').optional().isISO8601().withMessage('startDate harus format tanggal ISO 8601'),
  query('endDate').optional().isISO8601().withMessage('endDate harus format tanggal ISO 8601'),
  handleValidationErrors,
];

module.exports = { validateDateRangeQuery };
