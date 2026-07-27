// src/routes/web/tickets.js
'use strict';

const express = require('express');

const TicketWebController = require('../../controllers/web/ticket.controller');
const { requireWebAuth } = require('../../middlewares/webAuth.middleware');

const router = express.Router();

router.get('/tickets/:id/print', requireWebAuth, TicketWebController.print);
router.get('/tickets/:id', requireWebAuth, TicketWebController.detail);

module.exports = router;
