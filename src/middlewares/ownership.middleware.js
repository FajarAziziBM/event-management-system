// src/middlewares/ownership.middleware.js
'use strict';

const db = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Cek kepemilikan event (:id di params) SEBELUM middleware upload (Multer) jalan.
 * Tanpa ini, Multer akan menulis file ke disk lebih dulu — baru ketahuan gagal
 * otorisasi belakangan di controller, meninggalkan file yatim di disk padahal
 * request-nya ditolak (403). Middleware ini memastikan urutan yang benar:
 * autentikasi -> otorisasi role -> KEPEMILIKAN -> baru proses file upload.
 */
async function checkEventOwnership(req, res, next) {
  try {
    const event = await db.Event.findByPk(req.params.id);
    if (!event) {
      req.resume(); // buang sisa body (mis. multipart upload) supaya client tidak EPIPE
      return next(new NotFoundError('Event tidak ditemukan'));
    }

    if (req.user.role !== 'admin' && String(event.creatorId) !== String(req.user.id)) {
      req.resume();
      return next(new ForbiddenError('Anda bukan pemilik event ini'));
    }

    req.event = event; // hindari fetch ulang di service
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { checkEventOwnership };
