// src/validations/ticket.validation.js
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

const validateTicketId = [
  param('id').isInt({ min: 1 }).withMessage('ID tiket tidak valid'),
  handleValidationErrors,
];

const validateScanTicket = [
  body('payload').trim().notEmpty().withMessage('Payload QR/kode tiket wajib diisi'),
  handleValidationErrors,
];

module.exports = { validateTicketId, validateScanTicket };
