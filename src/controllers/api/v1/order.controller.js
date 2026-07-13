// src/controllers/api/v1/order.controller.js
'use strict';

const OrderService = require('../../../services/order.service');
const ApiResponse = require('../../../utils/ApiResponse');

class OrderController {
  /** ORD-01: POST /api/v1/orders */
  static async create(req, res, next) {
    try {
      const { eventId, quantity } = req.body;
      const order = await OrderService.createOrder(req.user.id, { eventId, quantity });
      res.status(201).json(ApiResponse.success('Order berhasil dibuat', order));
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
