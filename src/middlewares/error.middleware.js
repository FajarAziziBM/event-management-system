'use strict';

const logger = require('../config/logger');
const config = require('../config/env');
const ApiResponse = require('../utils/ApiResponse');
const { AppError, NotFoundError } = require('../utils/errors');

function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/');
}

/**
 * Dipasang PALING TERAKHIR setelah seluruh route terdaftar — menangkap request
 * ke route yang memang tidak ada.
 */
function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} tidak ditemukan`));
}

/**
 * Global error handler. Harus punya 4 parameter (err, req, res, next) agar
 * dikenali Express sebagai error-handling middleware — jangan dihapus meski
 * `next` tidak dipakai.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? err.statusCode : 500;
  const message =
    isOperational || !config.isProduction ? err.message : 'Terjadi kesalahan pada server';

  if (isOperational) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl} -> 500: ${err.message}`, {
      stack: err.stack,
    });
  }

  if (isApiRequest(req)) {
    res.status(statusCode).json(ApiResponse.error(message, isOperational ? err.details : null));
    return;
  }

  res.status(statusCode).render('errors/error', {
    title: statusCode === 404 ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan',
    statusCode,
    message,
  });
}

module.exports = { notFoundHandler, errorHandler };
