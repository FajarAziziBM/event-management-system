// src/services/payment.service.js
'use strict';

const db = require('../models');
const logger = require('../config/logger');
const XenditService = require('./xendit.service');
const generateTicketCode = require('../utils/generateTicketCode');
const { signQrPayload } = require('../utils/signQrPayload');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');

function assertOrderOwnership(order, userId, userRole) {
  if (userRole === 'admin') return;
  if (String(order.userId) !== String(userId)) {
    throw new ForbiddenError('Anda bukan pemilik order ini');
  }
}

class PaymentService {
  /**
   * PAY-02, PAY-03: Buat invoice Xendit untuk sebuah order & simpan ke tabel payments.
   * Dipanggil otomatis saat order dibuat (lihat order.controller.js), dan bisa
   * dipanggil ulang (lazy retry) lewat getPaymentUrl() kalau belum ada payment-nya.
   */
  static async createInvoiceForOrder(orderId) {
    const order = await db.Order.findByPk(orderId, {
      include: [
        { model: db.Event, as: 'event' },
        { model: db.User, as: 'user' },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order tidak ditemukan');
    }

    const response = await XenditService.createInvoice({
      externalId: order.orderNumber,
      amount: parseFloat(order.totalAmount),
      payerEmail: order.user.email,
      description: `Pembayaran tiket: ${order.event.title}`,
    });

    // PAY-03: simpan field penting dari response ke tabel payments
    const payment = await db.Payment.create({
      orderId: order.id,
      provider: 'xendit',
      invoiceId: response.id,
      externalId: response.externalId,
      paymentUrl: response.invoiceUrl,
      status: 'pending',
      expiredAt: response.expiryDate,
    });

    return payment;
  }

  /**
   * PAY-04: Ambil payment_url untuk redirect customer. Kalau payment belum ada
   * (mis. gagal saat order dibuat karena Xendit sempat down), coba buat lagi
   * di sini (lazy retry) alih-alih membiarkan customer buntu.
   */
  static async getPaymentUrl(orderId, userId, userRole) {
    const order = await db.Order.findByPk(orderId, {
      include: [{ model: db.Payment, as: 'payment' }],
    });

    if (!order) {
      throw new NotFoundError('Order tidak ditemukan');
    }
    assertOrderOwnership(order, userId, userRole);

    if (order.paymentStatus !== 'pending') {
      throw new ConflictError(
        `Order berstatus '${order.paymentStatus}', tidak ada payment_url yang perlu ditampilkan`,
      );
    }

    if (order.payment && order.payment.paymentUrl) {
      return { paymentUrl: order.payment.paymentUrl, expiredAt: order.payment.expiredAt };
    }

    const payment = await this.createInvoiceForOrder(order.id);
    return { paymentUrl: payment.paymentUrl, expiredAt: payment.expiredAt };
  }

  /**
   * PAY-10: Polling status dari sisi frontend.
   */
  static async getPaymentStatus(orderId, userId, userRole) {
    const order = await db.Order.findByPk(orderId, {
      include: [{ model: db.Payment, as: 'payment' }],
    });

    if (!order) {
      throw new NotFoundError('Order tidak ditemukan');
    }
    assertOrderOwnership(order, userId, userRole);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.paymentStatus,
      paymentStatus: order.payment ? order.payment.status : null,
      paidAt: order.paidAt,
    };
  }

  /**
   * PAY-05/06/07/08/09: Proses webhook Xendit.
   * Payload di sini SNAKE_CASE (external_id, payment_method, paid_at, dst) —
   * ini payload MENTAH dari HTTP POST Xendit, bukan lewat SDK, jadi format
   * fieldnya beda dengan XenditService (yang camelCase). Lihat catatan di
   * xendit.service.js untuk penjelasan lengkap.
   *
   * PAY-09: seluruh proses ada di SATU transaksi dengan payment row di-lock,
   * jadi kalau Xendit retry webhook yang sama (atau dua webhook nyaris
   * bersamaan), request kedua akan menunggu request pertama commit, lalu
   * lihat status sudah berubah dan langsung skip (idempotent).
   */
  static async handleWebhook(payload) {
    const externalId = payload.external_id;
    const { status } = payload;

    logger.info('[webhook:xendit] payload diterima', {
      externalId,
      status,
      invoiceId: payload.id,
    });

    return db.sequelize.transaction(async (t) => {
      const payment = await db.Payment.findOne({
        where: { externalId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!payment) {
        logger.warn('[webhook:xendit] Payment tidak ditemukan untuk external_id', { externalId });
        return { handled: false, reason: 'payment_not_found' };
      }

      // PAY-09: idempotency guard — status final tidak diproses ulang
      if (['paid', 'expired'].includes(payment.status)) {
        logger.info('[webhook:xendit] Sudah diproses sebelumnya, skip (idempotent)', {
          externalId,
          currentStatus: payment.status,
        });
        return { handled: true, alreadyProcessed: true };
      }

      if (status === 'PAID' || status === 'SETTLED') {
        return this._handlePaid(payment, payload, t);
      }

      if (status === 'EXPIRED') {
        return this._handleExpired(payment, t);
      }

      logger.info('[webhook:xendit] Status diabaikan (bukan status final)', { externalId, status });
      return { handled: true, ignored: true, status };
    });
  }

  /**
   * PAY-07: status PAID/SETTLED -> update payments+orders, generate tiket
   */
  static async _handlePaid(payment, payload, t) {
    const paidAt = payload.paid_at ? new Date(payload.paid_at) : new Date();

    await payment.update({ status: 'paid', paidAt }, { transaction: t });

    const order = await db.Order.findByPk(payment.orderId, { transaction: t });
    await order.update(
      {
        paymentStatus: 'paid',
        paidAt,
        paymentMethod: payload.payment_method || null,
      },
      { transaction: t },
    );

    const tickets = await this._generateTickets(order, t);

    logger.info('[webhook:xendit] Order PAID diproses, tiket digenerate', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      ticketCount: tickets.length,
    });

    return { handled: true, status: 'paid', ticketsGenerated: tickets.length };
  }

  /**
   * PAY-08: status EXPIRED -> update status, kembalikan kuota, TIDAK generate tiket
   */
  static async _handleExpired(payment, t) {
    await payment.update({ status: 'expired' }, { transaction: t });

    const order = await db.Order.findByPk(payment.orderId, { transaction: t });

    if (order.paymentStatus === 'pending') {
      await order.update({ paymentStatus: 'expired' }, { transaction: t });

      const event = await db.Event.findByPk(order.eventId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (event) {
        await event.update(
          { availableTicket: event.availableTicket + order.quantity },
          { transaction: t },
        );
      }
    }

    logger.info('[webhook:xendit] Order EXPIRED diproses, kuota dikembalikan', {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

    return { handled: true, status: 'expired' };
  }

  /**
   * PAY-07 (bagian generate tiket): satu ticket per quantity, ticket_code +
   * qr_code (payload ter-signature, lihat utils/signQrPayload.js).
   */
  static async _generateTickets(order, transaction) {
    const user = await db.User.findByPk(order.userId, { transaction });
    const tickets = [];

    for (let i = 0; i < order.quantity; i += 1) {
      const ticketCode = generateTicketCode(order.eventId);

      const ticket = await db.Ticket.create(
        {
          orderId: order.id,
          eventId: order.eventId,
          ticketCode,
          qrCode: signQrPayload(ticketCode),
          attendeeName: user.name,
          attendeeEmail: user.email,
          attendeePhone: user.phone,
        },
        { transaction },
      );

      tickets.push(ticket);
    }

    return tickets;
  }
}

module.exports = PaymentService;
