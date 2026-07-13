// src/utils/errors/ConflictError.js
'use strict';

const AppError = require('./AppError');

class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, details);
  }
}

module.exports = ConflictError;
