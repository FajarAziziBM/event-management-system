// src/routes/api/v1/attachment.js
'use strict';

const express = require('express');

const AttachmentController = require('../../../controllers/api/v1/attachment.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const { validateAttachmentId } = require('../../../validations/event.validation');

const router = express.Router();

// EVT-08: organizer (pemilik event induk)/admin — kepemilikan dicek di service layer
router.delete(
  '/:id',
  authenticate,
  authorize('organizer', 'admin'),
  validateAttachmentId,
  AttachmentController.remove,
);

module.exports = router;
