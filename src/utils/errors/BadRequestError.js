// src/utils/errors/BadRequestError.js
'use strict';

const AppError = require('./AppError');

class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = null) {
    super(message, 400, details);
  }
}

module.exports = BadRequestError;
