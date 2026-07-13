// src/utils/errors/ForbiddenError.js
'use strict';

const AppError = require('./AppError');

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, details);
  }
}

module.exports = ForbiddenError;
