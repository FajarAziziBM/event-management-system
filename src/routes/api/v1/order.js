// src/routes/api/v1/order.js
'use strict';

const express = require('express');

const OrderController = require('../../../controllers/api/v1/order.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const { validateCreateOrder, validateOrderId } = require('../../../validations/order.validation');

const router = express.Router();

// Seluruh endpoint order butuh login — siapapun (customer/organizer/admin) boleh
// membeli tiket, tidak dibatasi authorize(role) tertentu.
router.post('/', authenticate, validateCreateOrder, OrderController.create);
router.get('/', authenticate, OrderController.list);
router.get('/:id', authenticate, validateOrderId, OrderController.getById);
router.patch('/:id/cancel', authenticate, validateOrderId, OrderController.cancel);

module.exports = router;
