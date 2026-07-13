// src/services/order.service.js
'use strict';

const { Op } = require('sequelize');

const db = require('../models');
const config = require('../config/env');
const generateOrderNumber = require('../utils/generateOrderNumber');
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} = require('../utils/errors');

const MAX_QUANTITY_PER_ORDER = 10;

class OrderService {
  static _assertOwnership(order, userId, userRole) {
    if (userRole === 'admin') return;
    if (String(order.userId) !== String(userId)) {
      throw new ForbiddenError('Anda bukan pemilik order ini');
    }
  }

  static async _generateUniqueOrderNumber(transaction) {
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = generateOrderNumber();
      const existing = await db.Order.findOne({ where: { orderNumber: candidate }, transaction });
      if (!existing) return candidate;
    }
    throw new Error('Gagal generate order_number unik setelah beberapa percobaan');
  }

  /**
   * ORD-01, ORD-02, ORD-03, ORD-04: Buat order baru.
   * Seluruh pembacaan kuota + pengurangannya + pembuatan order terjadi dalam
   * SATU transaksi dengan row lock (SELECT ... FOR UPDATE) di baris event,
   * supaya dua request bersamaan pada tiket tersisa terakhir tidak sama-sama lolos.
   */
  static async createOrder(userId, { eventId, quantity }) {
    if (quantity > MAX_QUANTITY_PER_ORDER) {
      throw new ValidationError(`Maksimal ${MAX_QUANTITY_PER_ORDER} tiket per order`, {
        quantity: `Maksimal ${MAX_QUANTITY_PER_ORDER} tiket per order`,
      });
    }

    return db.sequelize.transaction(async (t) => {
      // ORD-04: row lock — request lain yang menyentuh baris event yang sama
      // akan menunggu sampai transaksi ini commit/rollback.
      const event = await db.Event.findByPk(eventId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!event) {
        throw new NotFoundError('Event tidak ditemukan');
      }

      if (event.status !== 'published') {
        throw new ValidationError('Event ini tidak sedang dibuka untuk pemesanan');
      }

      if (new Date(event.eventDate) < new Date()) {
        throw new ValidationError('Event sudah berlalu, tidak bisa dipesan');
      }

      if (event.availableTicket < quantity) {
        throw new ValidationError(
          `Kuota tersisa hanya ${event.availableTicket}, tidak mencukupi untuk ${quantity} tiket`,
          { quantity: 'Kuota tidak mencukupi' },
        );
      }

      // ORD-04: kurangi kuota di transaksi & koneksi yang sama dengan pembacaan di atas
      await event.update({ availableTicket: event.availableTicket - quantity }, { transaction: t });

      // ORD-03: kalkulasi otomatis
      const subtotal = parseFloat(event.ticketPrice) * quantity;
      const serviceFee = Math.round(subtotal * (config.order.serviceFeePercentage / 100));
      const totalAmount = subtotal + serviceFee;

      // ORD-02
      const orderNumber = await this._generateUniqueOrderNumber(t);

      const expiredAt = new Date(Date.now() + config.order.expiryMinutes * 60 * 1000);

      const order = await db.Order.create(
        {
          orderNumber,
          userId,
          eventId,
          quantity,
          subtotal,
          serviceFee,
          totalAmount,
          paymentStatus: 'pending',
          expiredAt,
        },
        { transaction: t },
      );

      return order;
    });
  }

  /**
   * ORD-05: Riwayat order milik user sendiri (paginated)
   */
  static async listMyOrders(userId, filters = {}) {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const { count, rows } = await db.Order.findAndCountAll({
      where: { userId },
      include: [
        {
          model: db.Event,
          as: 'event',
          attributes: ['id', 'title', 'slug', 'eventDate', 'venue'],
        },
        { model: db.Payment, as: 'payment' },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      orders: rows,
      pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) },
    };
  }

  /**
   * ORD-06: Detail order — hanya pemilik/admin
   */
  static async getOrderById(id, userId, userRole) {
    const order = await db.Order.findByPk(id, {
      include: [
        { model: db.Event, as: 'event' },
        { model: db.Payment, as: 'payment' },
        { model: db.Ticket, as: 'tickets' },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order tidak ditemukan');
    }

    this._assertOwnership(order, userId, userRole);
    return order;
  }

  /**
   * ORD-07: Batalkan order pending, kembalikan kuota ke event (dalam transaksi)
   */
  static async cancelOrder(id, userId, userRole) {
    return db.sequelize.transaction(async (t) => {
      const order = await db.Order.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });

      if (!order) {
        throw new NotFoundError('Order tidak ditemukan');
      }

      this._assertOwnership(order, userId, userRole);

      if (order.paymentStatus !== 'pending') {
        throw new ConflictError(
          `Order berstatus '${order.paymentStatus}', hanya order 'pending' yang bisa dibatalkan`,
        );
      }

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

      await order.update({ paymentStatus: 'cancelled' }, { transaction: t });

      return order;
    });
  }

  /**
   * ORD-08: Dipanggil oleh scheduled job (lihat src/jobs/expireOrders.job.js).
   * Diekspos sebagai method terpisah (bukan langsung di dalam cron callback)
   * supaya bisa dites langsung tanpa menunggu jadwal cron sungguhan.
   */
  static async expirePendingOrders() {
    const now = new Date();
    const candidates = await db.Order.findAll({
      where: { paymentStatus: 'pending', expiredAt: { [Op.lt]: now } },
    });

    let expiredCount = 0;

    for (const order of candidates) {
      await db.sequelize.transaction(async (t) => {
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
        await order.update({ paymentStatus: 'expired' }, { transaction: t });
      });
      expiredCount += 1;
    }

    return { expiredCount };
  }
}

module.exports = OrderService;
