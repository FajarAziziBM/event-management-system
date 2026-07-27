// src/controllers/web/ticket.controller.js
'use strict';

const TicketService = require('../../services/ticket.service');

const TicketWebController = {
  /** GET /tickets/:id */
  async detail(req, res, next) {
    try {
      const ticket = await TicketService.getTicketById(req.params.id, req.user.id, req.user.role);
      res.render('tickets/detail', { title: `Tiket ${ticket.ticketCode}`, ticket });
    } catch (err) {
      next(err);
    }
  },

  /** GET /tickets/:id/print — versi cetak/print-friendly, tanpa nav & footer */
  async print(req, res, next) {
    try {
      const ticket = await TicketService.getTicketById(req.params.id, req.user.id, req.user.role);
      res.render('tickets/print', { title: `Cetak Tiket ${ticket.ticketCode}`, ticket, layout: false });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = TicketWebController;
