// src/routes/api/v1/event.js
'use strict';

const express = require('express');

const EventController = require('../../../controllers/api/v1/event.controller');
const {
  authenticate,
  authorize,
  authenticateOptional,
} = require('../../../middlewares/auth.middleware');
const { checkEventOwnership } = require('../../../middlewares/ownership.middleware');
const { uploadBanner, uploadAttachment } = require('../../../middlewares/upload.middleware');
const {
  validateCreateEvent,
  validateUpdateEvent,
  validateEventId,
  validateUnpublish,
  validateListQuery,
} = require('../../../validations/event.validation');

const router = express.Router();

// EVT-09 & EVT-11: publik
router.get('/', validateListQuery, EventController.list);

// EVT-10: publik, tapi authenticateOptional supaya owner/admin bisa preview draft miliknya
router.get('/:slug', authenticateOptional, EventController.getBySlug);

// EVT-01: organizer/admin
router.post(
  '/',
  authenticate,
  authorize('organizer', 'admin'),
  validateCreateEvent,
  EventController.create,
);

// EVT-02: organizer (pemilik)/admin — kepemilikan dicek di service layer
router.put(
  '/:id',
  authenticate,
  authorize('organizer', 'admin'),
  validateUpdateEvent,
  EventController.update,
);

// EVT-03
router.delete(
  '/:id',
  authenticate,
  authorize('organizer', 'admin'),
  validateEventId,
  EventController.remove,
);

// EVT-04
router.patch(
  '/:id/publish',
  authenticate,
  authorize('organizer', 'admin'),
  validateEventId,
  EventController.publish,
);

// EVT-05
router.patch(
  '/:id/unpublish',
  authenticate,
  authorize('organizer', 'admin'),
  validateUnpublish,
  EventController.unpublish,
);

// EVT-06
router.post(
  '/:id/banner',
  authenticate,
  authorize('organizer', 'admin'),
  validateEventId,
  checkEventOwnership,
  uploadBanner,
  EventController.uploadBanner,
);

// EVT-07
router.post(
  '/:id/attachments',
  authenticate,
  authorize('organizer', 'admin'),
  validateEventId,
  checkEventOwnership,
  uploadAttachment,
  EventController.uploadAttachment,
);

module.exports = router;
