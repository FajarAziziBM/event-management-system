// src/middlewares/verifyXenditWebhook.middleware.js
'use strict';

const crypto = require('node:crypto');

const config = require('../config/env');
const logger = require('../config/logger');
const { UnauthorizedError } = require('../utils/errors');

/**
 * PAY-06: Bandingkan header x-callback-token dengan XENDIT_CALLBACK_TOKEN
 * pakai crypto.timingSafeEqual (constant-time) supaya durasi respons tidak
 * bisa dipakai menebak token karakter demi karakter (timing attack).
 *
 * PENTING: timingSafeEqual MELEMPAR ERROR (bukan return false) kalau dua
 * buffer beda panjang — makanya panjang dicek dulu secara terpisah SEBELUM
 * memanggilnya, supaya token salah-panjang tidak bikin proses crash.
 */
function verifyXenditWebhook(req, res, next) {
  const receivedToken = req.headers['x-callback-token'];

  if (!receivedToken) {
    logger.warn('[webhook:xendit] Ditolak — header x-callback-token tidak ada');
    return next(new UnauthorizedError('Header x-callback-token wajib ada'));
  }

  const expected = Buffer.from(config.xendit.callbackToken);
  const received = Buffer.from(receivedToken);

  const isValid = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!isValid) {
    logger.warn('[webhook:xendit] Ditolak — x-callback-token tidak cocok');
    return next(new UnauthorizedError('x-callback-token tidak valid'));
  }

  next();
}

module.exports = { verifyXenditWebhook };
