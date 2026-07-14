// src/controllers/webhooks/xendit.controller.js
'use strict';

const PaymentService = require('../../services/payment.service');
const ApiResponse = require('../../utils/ApiResponse');
const logger = require('../../config/logger');

class XenditWebhookController {
  /**
   * PAY-05: POST /api/webhooks/xendit
   * Balas 200 secepat mungkin untuk kasus yang MEMANG tidak perlu diproses
   * ulang (payment tidak ditemukan, sudah diproses sebelumnya/idempotent).
   * Tapi kalau terjadi error TAK TERDUGA (bug, DB down, dst), sengaja
   * diteruskan ke error handler global (-> 500) supaya Xendit retry —
   * retry itu justru yang kita mau kalau kegagalannya bersifat sementara.
   */
  static async receive(req, res, next) {
    try {
      const result = await PaymentService.handleWebhook(req.body);
      res.status(200).json(ApiResponse.success('Webhook diterima', result));
    } catch (err) {
      logger.error('[webhook:xendit] Gagal memproses payload', {
        error: err.message,
        externalId: req.body ? req.body.external_id : undefined,
      });
      next(err);
    }
  }
}

module.exports = XenditWebhookController;
