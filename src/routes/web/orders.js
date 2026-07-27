// src/routes/web/orders.js
'use strict';

const express = require('express');

const OrderWebController = require('../../controllers/web/order.controller');
const { requireWebAuth } = require('../../middlewares/webAuth.middleware');

const router = express.Router();

router.get('/events/:slug/checkout', requireWebAuth, OrderWebController.checkoutForm);

router.post('/orders', requireWebAuth, OrderWebController.create);

// Rute spesifik (success/failed) HARUS sebelum /orders/:id, supaya tidak ketangkap sebagai :id
router.get('/orders/success', requireWebAuth, OrderWebController.success);
router.get('/orders/failed', requireWebAuth, OrderWebController.failed);

router.get('/orders', requireWebAuth, OrderWebController.myOrders);
router.get('/orders/:id', requireWebAuth, OrderWebController.detail);
router.get('/orders/:id/status', requireWebAuth, OrderWebController.statusJson);
router.post('/orders/:id/cancel', requireWebAuth, OrderWebController.cancel);

module.exports = router;
