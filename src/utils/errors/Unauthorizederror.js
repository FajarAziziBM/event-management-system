'use strict';

const AppError = require('./AppError');

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, details);
  }
}

module.exports = UnauthorizedError;
