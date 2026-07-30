// src/routes/web/orders.js
'use strict';

const express = require('express');

const OrderWebController = require('../../controllers/web/order.controller');
const { requireWebAuth } = require('../../middlewares/webAuth.middleware');
const { requireCsrf } = require('../../middlewares/csrf.middleware');
// SEC-04: validator yang sama dengan yang dipakai API — satu sumber kebenaran.
const { validateCreateOrder, validateOrderId } = require('../../validations/order.validation');

const router = express.Router();

router.get('/events/:slug/checkout', requireWebAuth, OrderWebController.checkoutForm);

router.post('/orders', requireWebAuth, requireCsrf, validateCreateOrder, OrderWebController.create);

// Rute spesifik (success/failed) HARUS sebelum /orders/:id, supaya tidak ketangkap sebagai :id
router.get('/orders/success', requireWebAuth, OrderWebController.success);
router.get('/orders/failed', requireWebAuth, OrderWebController.failed);

router.get('/orders', requireWebAuth, OrderWebController.myOrders);
router.get('/orders/:id', requireWebAuth, validateOrderId, OrderWebController.detail);
router.get('/orders/:id/status', requireWebAuth, validateOrderId, OrderWebController.statusJson);
router.post(
  '/orders/:id/cancel',
  requireWebAuth,
  requireCsrf,
  validateOrderId,
  OrderWebController.cancel,
);

module.exports = router;
