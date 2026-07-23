// src/routes/api/v1/admin.js
'use strict';

const express = require('express');

const AdminController = require('../../../controllers/api/v1/admin.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const { validateDateRangeQuery } = require('../../../validations/dashboard.validation');
const { validateSearchAllQuery } = require('../../../validations/search.validation');

const router = express.Router();

// Seluruh endpoint di sini admin-only — BEDA dengan /organizer yang juga
// mengizinkan role 'organizer' (di sini strictly authorize('admin')).
router.get('/dashboard', authenticate, authorize('admin'), AdminController.getDashboard);
router.get(
  '/reports/revenue',
  authenticate,
  authorize('admin'),
  validateDateRangeQuery,
  AdminController.getRevenueReport,
);
router.get(
  '/reports/users',
  authenticate,
  authorize('admin'),
  validateDateRangeQuery,
  AdminController.getUserReport,
);
router.get(
  '/reports/payments',
  authenticate,
  authorize('admin'),
  validateDateRangeQuery,
  AdminController.getPaymentReport,
);

// SEARCH-02: pencarian lintas entitas (users/events/orders/payments)
router.get(
  '/search',
  authenticate,
  authorize('admin'),
  validateSearchAllQuery,
  AdminController.searchAll,
);

module.exports = router;