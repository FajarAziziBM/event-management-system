'use strict';

const AppError = require('./AppError');

/**
 * Dipakai saat komunikasi ke Xendit gagal (invoice tidak terbentuk, API error, dll).
 * Default 502 karena secara semantik ini kegagalan upstream/gateway, bukan
 * kesalahan input dari customer — status bisa dioverride sesuai konteks.
 */
class PaymentError extends AppError {
  constructor(message = 'Payment processing error', statusCode = 502, details = null) {
    super(message, statusCode, details);
  }
}

module.exports = PaymentError;
