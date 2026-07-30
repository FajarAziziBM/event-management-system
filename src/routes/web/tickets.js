// src/routes/web/tickets.js
'use strict';

const express = require('express');

const TicketWebController = require('../../controllers/web/ticket.controller');
const { requireWebAuth } = require('../../middlewares/webAuth.middleware');
const { validateTicketId } = require('../../validations/ticket.validation');

const router = express.Router();

router.get('/tickets/:id/print', requireWebAuth, validateTicketId, TicketWebController.print);
router.get('/tickets/:id', requireWebAuth, validateTicketId, TicketWebController.detail);

module.exports = router;
