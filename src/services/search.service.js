// src/services/search.service.js
'use strict';

const { Op } = require('sequelize');

const db = require('../models');

function buildPagination(filters = {}, defaultLimit = 10) {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || defaultLimit, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginationMeta(page, limit, count) {
  return { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) };
}

class SearchService {
  /**
   * SEARCH-01: Pencarian & filter order milik organizer (lintas semua event
   * miliknya, bukan per-event) — cari nomor order/nama/email customer,
   * filter status pembayaran & event tertentu.
   */
  static async searchOrganizerOrders(organizerId, filters = {}) {
    const { page, limit, offset } = buildPagination(filters);
    const { search, status, eventId } = filters;

    const where = { '$event.creator_id$': organizerId };
    if (status) {
      where.paymentStatus = status;
    }
    if (eventId) {
      where.eventId = eventId;
    }
    if (search) {
      where[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { '$user.name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await db.Order.findAndCountAll({
      where,
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: db.Event, as: 'event', attributes: ['id', 'title', 'creatorId'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false, // wajib false supaya limit/offset tetap benar saat where merujuk kolom hasil include
    });

    return { orders: rows, pagination: paginationMeta(page, limit, count) };
  }

  /**
   * SEARCH-01: Pencarian & filter tiket milik organizer (lintas semua event
   * miliknya) — cari kode tiket/nama/email attendee, filter status check-in
   * & event tertentu.
   */
  static async searchOrganizerTickets(organizerId, filters = {}) {
    const { page, limit, offset } = buildPagination(filters);
    const { search, isCheckedIn, eventId } = filters;

    const where = { '$event.creator_id$': organizerId };
    if (eventId) {
      where.eventId = eventId;
    }
    if (isCheckedIn !== undefined) {
      where.isCheckedIn = isCheckedIn === 'true' || isCheckedIn === true;
    }
    if (search) {
      where[Op.or] = [
        { ticketCode: { [Op.like]: `%${search}%` } },
        { attendeeName: { [Op.like]: `%${search}%` } },
        { attendeeEmail: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await db.Ticket.findAndCountAll({
      where,
      include: [
        { model: db.Event, as: 'event', attributes: ['id', 'title', 'creatorId'] },
        { model: db.Order, as: 'order', attributes: ['id', 'orderNumber'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });

    return { tickets: rows, pagination: paginationMeta(page, limit, count) };
  }

  /**
   * SEARCH-02: Pencarian lintas entitas untuk admin — satu query string,
   * dicari paralel di users/events/orders/payments. Hasil dibatasi per
   * kategori (bukan pagination penuh) karena ini "quick search" gaya
   * command-palette; untuk browse lengkap per entitas, pakai endpoint
   * masing-masing yang sudah ada (USR-01, dst).
   */
  static async searchAll(query, limitPerCategory = 5) {
    const like = `%${query}%`;

    const [users, events, orders, payments] = await Promise.all([
      db.User.findAll({
        where: { [Op.or]: [{ name: { [Op.like]: like } }, { email: { [Op.like]: like } }] },
        attributes: { exclude: ['password'] },
        limit: limitPerCategory,
      }),
      // Sengaja TANPA filter status='published' -- ini pencarian admin,
      // harus bisa menemukan draft/closed/cancelled juga (beda dari EVT-09).
      db.Event.findAll({
        where: { title: { [Op.like]: like } },
        attributes: ['id', 'title', 'slug', 'status', 'eventDate'],
        limit: limitPerCategory,
      }),
      db.Order.findAll({
        where: { orderNumber: { [Op.like]: like } },
        include: [
          { model: db.User, as: 'user', attributes: ['name', 'email'] },
          { model: db.Event, as: 'event', attributes: ['title'] },
        ],
        limit: limitPerCategory,
        subQuery: false,
      }),
      db.Payment.findAll({
        where: {
          [Op.or]: [{ invoiceId: { [Op.like]: like } }, { externalId: { [Op.like]: like } }],
        },
        include: [{ model: db.Order, as: 'order', attributes: ['orderNumber'] }],
        limit: limitPerCategory,
        subQuery: false,
      }),
    ]);

    return {
      query,
      users,
      events,
      orders,
      payments,
      totalMatches: users.length + events.length + orders.length + payments.length,
    };
  }
}

module.exports = SearchService;
