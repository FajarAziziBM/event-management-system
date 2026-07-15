// src/routes/api/v1/order.js
'use strict';

const express = require('express');

const OrderController = require('../../../controllers/api/v1/order.controller');
const PaymentController = require('../../../controllers/api/v1/payment.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const { validateCreateOrder, validateOrderId } = require('../../../validations/order.validation');

const router = express.Router();

// Seluruh endpoint order butuh login — siapapun (customer/organizer/admin) boleh
// membeli tiket, tidak dibatasi authorize(role) tertentu.
router.post('/', authenticate, validateCreateOrder, OrderController.create);
router.get('/', authenticate, OrderController.list);
router.get('/:id', authenticate, validateOrderId, OrderController.getById);
router.patch('/:id/cancel', authenticate, validateOrderId, OrderController.cancel);

// PAY-04 & PAY-10: sub-resource payment milik order
router.get('/:id/payment', authenticate, validateOrderId, PaymentController.getPaymentUrl);
router.get(
  '/:id/payment-status',
  authenticate,
  validateOrderId,
  PaymentController.getPaymentStatus,
);

module.exports = router;
