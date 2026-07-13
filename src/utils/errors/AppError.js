// src/utils/errors/AppError.js
'use strict';

/**
 * Base class untuk seluruh error "terduga" (operational error) dalam aplikasi —
 * error bisnis yang memang diharapkan bisa terjadi (400/401/403/404/409/422/dst),
 * dibedakan dari bug/exception tak terduga yang harus dianggap fatal (500).
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
