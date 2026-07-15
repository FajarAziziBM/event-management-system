// src/services/xendit.service.js
'use strict';

const { Invoice } = require('../config/xendit');
const config = require('../config/env');
const logger = require('../config/logger');
const { PaymentError } = require('../utils/errors');

class XenditService {
  /**
   * PAY-02: Buat invoice Xendit (POST /v2/invoices via SDK).
   * PAY-11: Log request & response (atau error) untuk audit rekonsiliasi.
   *
   * Catatan penting: SDK xendit-node v7 pakai camelCase (externalId,
   * invoiceUrl, expiryDate, dst) untuk request/response — BEDA dengan webhook
   * mentah dari Xendit yang snake_case (lihat payment.service.js). Ini bukan
   * salah ketik, keduanya memang berbeda konvensi karena webhook tidak lewat SDK.
   */
  static async createInvoice({ externalId, amount, payerEmail, description }) {
    const payload = {
      externalId,
      amount,
      payerEmail,
      description,
      currency: 'IDR',
      // Sinkron dengan ORDER_EXPIRY_MINUTES supaya invoice & order kedaluwarsa bersamaan
      invoiceDuration: config.order.expiryMinutes * 60,
    };

    if (config.xendit.successRedirectUrl) {
      payload.successRedirectUrl = config.xendit.successRedirectUrl;
    }
    if (config.xendit.failureRedirectUrl) {
      payload.failureRedirectUrl = config.xendit.failureRedirectUrl;
    }

    logger.info('[xendit:createInvoice] request', { externalId, amount, payerEmail });

    try {
      const response = await Invoice.createInvoice({ data: payload });

      logger.info('[xendit:createInvoice] response OK', {
        externalId,
        invoiceId: response.id,
        status: response.status,
        invoiceUrl: response.invoiceUrl,
      });

      return response;
    } catch (err) {
      logger.error('[xendit:createInvoice] response GAGAL', {
        externalId,
        error: err.message,
        raw: err.response?.data || null,
      });
      throw new PaymentError(`Gagal membuat invoice Xendit: ${err.message}`);
    }
  }
}

module.exports = XenditService;
