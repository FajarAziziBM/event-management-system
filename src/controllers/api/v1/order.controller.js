// src/controllers/api/v1/order.controller.js
'use strict';

const OrderService = require('../../../services/order.service');
const PaymentService = require('../../../services/payment.service');
const NotificationService = require('../../../services/notification.service');
const ApiResponse = require('../../../utils/ApiResponse');
const logger = require('../../../config/logger');

class OrderController {
  /**
   * ORD-01 & PAY-02: POST /api/v1/orders — order dibuat dulu (transaksi aman,
   * tidak boleh gagal karena hal di luar kendali kita), BARU setelah itu coba
   * buat invoice Xendit. Kalau Xendit gagal/down, order TETAP jadi (kuota
   * pelanggan sudah diamankan) — payment_url bisa diambil lagi lewat
   * GET /orders/:id/payment yang otomatis retry pembuatan invoice.
   */
  static async create(req, res, next) {
    try {
      const { eventId, quantity } = req.body;
      const order = await OrderService.createOrder(req.user.id, { eventId, quantity });

      let paymentUrl = null;
      try {
        const payment = await PaymentService.createInvoiceForOrder(order.id);
        paymentUrl = payment.paymentUrl;
      } catch (err) {
        logger.error('[order.create] Order dibuat, tapi invoice Xendit gagal dibuat', {
          orderId: order.id,
          error: err.message,
        });
        // NOTIF-05: alert internal admin — masalah pembayaran
        await NotificationService.notifyAdminPaymentIssue(order, err.message);
      }

      res.status(201).json(
        ApiResponse.success('Order berhasil dibuat', {
          ...order.toJSON(),
          paymentUrl,
        }),
      );
    } catch (err) {
      next(err);
    }
  }

  /** ORD-05: GET /api/v1/orders */
  static async list(req, res, next) {
    try {
      const { orders, pagination } = await OrderService.listMyOrders(req.user.id, req.query);
      res.json(ApiResponse.success('OK', { orders, pagination }));
    } catch (err) {
      next(err);
    }
  }

  /** ORD-06: GET /api/v1/orders/:id */
  static async getById(req, res, next) {
    try {
      const order = await OrderService.getOrderById(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success('OK', order));
    } catch (err) {
      next(err);
    }
  }

  /** ORD-07: PATCH /api/v1/orders/:id/cancel */
  static async cancel(req, res, next) {
    try {
      const order = await OrderService.cancelOrder(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success('Order berhasil dibatalkan', order));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OrderController;
