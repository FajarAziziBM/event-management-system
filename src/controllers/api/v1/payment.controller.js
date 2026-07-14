// src/controllers/api/v1/payment.controller.js
'use strict';

const PaymentService = require('../../../services/payment.service');
const ApiResponse = require('../../../utils/ApiResponse');

class PaymentController {
  /** PAY-04: GET /api/v1/orders/:id/payment */
  static async getPaymentUrl(req, res, next) {
    try {
      const result = await PaymentService.getPaymentUrl(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success('OK', result));
    } catch (err) {
      next(err);
    }
  }

  /** PAY-10: GET /api/v1/orders/:id/payment-status */
  static async getPaymentStatus(req, res, next) {
    try {
      const result = await PaymentService.getPaymentStatus(
        req.params.id,
        req.user.id,
        req.user.role,
      );
      res.json(ApiResponse.success('OK', result));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PaymentController;
