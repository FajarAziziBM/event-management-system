// src/controllers/api/v1/ticket.controller.js
'use strict';

const PDFDocument = require('pdfkit');

const TicketService = require('../../../services/ticket.service');
const ApiResponse = require('../../../utils/ApiResponse');

class TicketController {
  /** TIX-03: GET /api/v1/tickets/:id */
  static async getById(req, res, next) {
    try {
      const ticket = await TicketService.getTicketById(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success('OK', ticket));
    } catch (err) {
      next(err);
    }
  }

  /** TIX-04: GET /api/v1/tickets/:id/download */
  static async download(req, res, next) {
    try {
      const { ticket, qrBuffer } = await TicketService.prepareTicketPdf(
        req.params.id,
        req.user.id,
        req.user.role,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="e-ticket-${ticket.ticketCode}.pdf"`,
      );

      const doc = new PDFDocument({ size: 'A5', margin: 40 });
      doc.pipe(res);
      TicketController._drawTicketPdf(doc, ticket, qrBuffer);
      doc.end();
    } catch (err) {
      next(err);
    }
  }

  /**
   * Layout e-ticket: header event, detail penonton, QR code, footer kode tiket.
   * Dipisah jadi method sendiri supaya download() tetap ringkas & mudah dibaca.
   */
  static _drawTicketPdf(doc, ticket, qrBuffer) {
    const eventDate = new Date(ticket.event.eventDate).toLocaleString('id-ID', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    doc.fontSize(18).font('Helvetica-Bold').text('E-TICKET', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .strokeColor('#1f6f6b')
      .lineWidth(2)
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .stroke();
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text(ticket.event.title);
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#5b6670');
    doc.text(`Tanggal: ${eventDate}`);
    doc.text(`Venue  : ${ticket.event.venue || '-'}`);
    doc.fillColor('#14232e');
    doc.moveDown(1);

    doc.fontSize(11).font('Helvetica-Bold').text('Peserta');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Nama  : ${ticket.attendeeName || '-'}`);
    doc.text(`Email : ${ticket.attendeeEmail || '-'}`);
    doc.moveDown(1);

    const qrSize = 160;
    const qrX = (doc.page.width - qrSize) / 2;
    doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
    doc.y += qrSize + 10;

    doc.fontSize(12).font('Helvetica-Bold').text(ticket.ticketCode, { align: 'center' });
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#5b6670')
      .text('Tunjukkan QR code ini di pintu masuk untuk check-in', { align: 'center' });
  }

  /** TIX-05, TIX-06, TIX-07: POST /api/v1/tickets/scan */
  static async scan(req, res, next) {
    try {
      const { ticket, event } = await TicketService.scanTicket(
        req.body.payload,
        req.user.id,
        req.user.role,
      );

      res.json(
        ApiResponse.success('Check-in berhasil', {
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeName,
          eventTitle: event.title,
          checkedInAt: ticket.checkedInAt,
        }),
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TicketController;
