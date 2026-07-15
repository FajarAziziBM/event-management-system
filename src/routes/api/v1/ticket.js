// src/routes/api/v1/ticket.js
'use strict';

const express = require('express');

const TicketController = require('../../../controllers/api/v1/ticket.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const { validateTicketId, validateScanTicket } = require('../../../validations/ticket.validation');

const router = express.Router();

// TIX-05: scan HARUS didaftarkan sebelum '/:id' supaya "scan" tidak
// tertangkap sebagai parameter :id oleh route detail di bawahnya.
router.post(
  '/scan',
  authenticate,
  authorize('organizer', 'admin'),
  validateScanTicket,
  TicketController.scan,
);

// TIX-03 & TIX-04: pemilik tiket (customer) ATAU organizer/admin — ownership
// dicek di service layer, jadi tidak dibatasi authorize(role) di sini.
router.get('/:id', authenticate, validateTicketId, TicketController.getById);
router.get('/:id/download', authenticate, validateTicketId, TicketController.download);

module.exports = router;
