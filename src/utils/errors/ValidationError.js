'use strict';

const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 422, details);
  }
}

module.exports = ValidationError;
