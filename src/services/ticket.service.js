// src/services/ticket.service.js
'use strict';

const db = require('../models');
const { generateQrCodeDataUrl, generateQrCodeBuffer } = require('../utils/generateQrCodeImage');
const { verifyQrPayload } = require('../utils/signQrPayload');
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} = require('../utils/errors');

const TICKET_INCLUDE = [
  { model: db.Event, as: 'event' },
  { model: db.Order, as: 'order' },
];

class TicketService {
  /**
   * Akses tiket diperbolehkan untuk: pemilik order (customer), organizer
   * pemilik event terkait, atau admin. Ketiganya punya alasan sah melihat
   * detail tiket yang sama.
   */
  static _assertTicketAccess(ticket, userId, userRole) {
    if (userRole === 'admin') return;
    const isOrderOwner = String(ticket.order.userId) === String(userId);
    const isEventOwner = String(ticket.event.creatorId) === String(userId);
    if (!isOrderOwner && !isEventOwner) {
      throw new ForbiddenError('Anda tidak berhak mengakses tiket ini');
    }
  }

  static async _findTicketOrThrow(id) {
    const ticket = await db.Ticket.findByPk(id, { include: TICKET_INCLUDE });
    if (!ticket) {
      throw new NotFoundError('Tiket tidak ditemukan');
    }
    return ticket;
  }

  /**
   * TIX-03: Detail tiket + gambar QR (data URL, siap dipakai <img src>)
   */
  static async getTicketById(id, userId, userRole) {
    const ticket = await this._findTicketOrThrow(id);
    this._assertTicketAccess(ticket, userId, userRole);

    const qrCodeImage = await generateQrCodeDataUrl(ticket.qrCode);

    return { ...ticket.toJSON(), qrCodeImage };
  }

  /**
   * TIX-04: Siapkan data untuk PDF (ticket + buffer QR). Penulisan PDF
   * sungguhan (layout, streaming ke response) ada di controller karena itu
   * urusan presentasi HTTP, bukan business logic.
   */
  static async prepareTicketPdf(id, userId, userRole) {
    const ticket = await this._findTicketOrThrow(id);
    this._assertTicketAccess(ticket, userId, userRole);

    const qrBuffer = await generateQrCodeBuffer(ticket.qrCode);

    return { ticket, qrBuffer };
  }

  /**
   * TIX-05, TIX-06, TIX-07: Scan tiket oleh organizer.
   * - Terima qr_code penuh ("ticket_code.signature") ATAU ticket_code polos
   *   (fallback input manual kalau kamera scanner gagal baca)
   * - Row lock HANYA di baris ticket (bukan ikut mengunci event/order) supaya
   *   proses scan tidak berebut lock dengan pembelian tiket (ORD-04) yang
   *   sama-sama menyentuh baris event.
   */
  static async scanTicket(rawPayload, organizerId, organizerRole) {
    if (!rawPayload || typeof rawPayload !== 'string') {
      throw new ValidationError('Payload QR/kode tiket wajib diisi');
    }

    const ticketCode = rawPayload.includes('.') ? rawPayload.split('.')[0] : rawPayload;

    return db.sequelize.transaction(async (t) => {
      const ticket = await db.Ticket.findOne({
        where: { ticketCode },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!ticket) {
        throw new NotFoundError('Tiket tidak ditemukan');
      }

      // TIX-06: kalau yang di-scan adalah payload penuh (bukan input manual),
      // signature-nya WAJIB valid — mendeteksi QR yang dipalsukan/diedit.
      if (rawPayload.includes('.') && !verifyQrPayload(rawPayload)) {
        throw new ValidationError('QR code tidak valid atau rusak');
      }

      const event = await db.Event.findByPk(ticket.eventId, { transaction: t });
      const order = await db.Order.findByPk(ticket.orderId, { transaction: t });

      // TIX-06: event harus milik organizer yang melakukan scan
      if (organizerRole !== 'admin' && String(event.creatorId) !== String(organizerId)) {
        throw new ForbiddenError('Tiket ini bukan untuk event yang Anda kelola');
      }

      // TIX-06: defensif — tiket seharusnya cuma ada kalau order sudah paid,
      // tapi tetap divalidasi ulang untuk jaga-jaga (mis. refund manual di masa depan)
      if (order.paymentStatus !== 'paid') {
        throw new ValidationError('Tiket ini terkait order yang belum/tidak lunas');
      }

      // TIX-07: cegah duplicate check-in
      if (ticket.isCheckedIn) {
        throw new ConflictError(
          `Tiket sudah check-in sebelumnya pada ${ticket.checkedInAt.toISOString()}`,
          { checkedInAt: ticket.checkedInAt },
        );
      }

      await ticket.update({ isCheckedIn: true, checkedInAt: new Date() }, { transaction: t });

      return { ticket, event, order };
    });
  }
}

module.exports = TicketService;
