// src/routes/api/v1/organizer.js
'use strict';

const express = require('express');

const OrganizerController = require('../../../controllers/api/v1/organizer.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const { validateEventId } = require('../../../validations/event.validation');

const router = express.Router();

// EVT-12: organizer (pemilik)/admin — kepemilikan dicek di service layer
router.get(
  '/events/:id/statistics',
  authenticate,
  authorize('organizer', 'admin'),
  validateEventId,
  OrganizerController.getEventStatistics,
);

module.exports = router;
