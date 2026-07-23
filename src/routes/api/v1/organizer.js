// src/routes/api/v1/organizer.js
'use strict';

const express = require('express');

const OrganizerController = require('../../../controllers/api/v1/organizer.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const { validateEventId } = require('../../../validations/event.validation');
const { validateDateRangeQuery } = require('../../../validations/dashboard.validation');
const {
  validateSearchOrdersQuery,
  validateSearchTicketsQuery,
} = require('../../../validations/search.validation');

const router = express.Router();

// EVT-12: organizer (pemilik)/admin — kepemilikan dicek di service layer
router.get(
  '/events/:id/statistics',
  authenticate,
  authorize('organizer', 'admin'),
  validateEventId,
  OrganizerController.getEventStatistics,
);

// DASH-01: ringkasan dashboard organizer
router.get(
  '/dashboard',
  authenticate,
  authorize('organizer', 'admin'),
  OrganizerController.getDashboard,
);

// DASH-03: laporan penjualan (opsional ?startDate=&endDate=)
router.get(
  '/reports/sales',
  authenticate,
  authorize('organizer', 'admin'),
  validateDateRangeQuery,
  OrganizerController.getSalesReport,
);

// DASH-04: performa seluruh event milik organizer (perbandingan antar event)
router.get(
  '/reports/event-performance',
  authenticate,
  authorize('organizer', 'admin'),
  OrganizerController.getEventPerformanceReport,
);

// SEARCH-01: cari & filter order/tiket lintas semua event milik organizer
router.get(
  '/orders',
  authenticate,
  authorize('organizer', 'admin'),
  validateSearchOrdersQuery,
  OrganizerController.searchOrders,
);
router.get(
  '/tickets',
  authenticate,
  authorize('organizer', 'admin'),
  validateSearchTicketsQuery,
  OrganizerController.searchTickets,
);

module.exports = router;