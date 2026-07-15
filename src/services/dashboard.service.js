// src/services/dashboard.service.js
'use strict';

const { Op, QueryTypes } = require('sequelize');

const db = require('../models');
const cache = require('../utils/simpleCache');

const CACHE_TTL_MS = 60 * 1000; // 60 detik — lihat catatan di simpleCache.js

class DashboardService {
  /**
   * DASH-01: Ringkasan dashboard organizer — event, tiket terjual, revenue,
   * visitor (jumlah tiket terbit = calon/aktual penonton), event mendatang.
   * Tidak di-cache (scope kecil, data milik organizer sendiri harus real-time).
   */
  static async getOrganizerDashboard(organizerId) {
    const eventsByStatusRaw = await db.Event.findAll({
      where: { creatorId: organizerId },
      attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    const eventsByStatus = { draft: 0, published: 0, closed: 0, cancelled: 0 };
    let totalEvents = 0;
    eventsByStatusRaw.forEach((row) => {
      const count = parseInt(row.count, 10);
      eventsByStatus[row.status] = count;
      totalEvents += count;
    });

    const [salesAgg] = await db.sequelize.query(
      `SELECT COALESCE(SUM(o.quantity), 0) AS ticketsSold,
              COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE e.creator_id = :organizerId AND o.payment_status = 'paid'`,
      { replacements: { organizerId }, type: QueryTypes.SELECT },
    );

    const totalVisitors = await db.Ticket.count({
      include: [
        { model: db.Event, as: 'event', attributes: [], where: { creatorId: organizerId } },
      ],
    });

    const upcomingEvents = await db.Event.findAll({
      where: { creatorId: organizerId, status: 'published', eventDate: { [Op.gt]: new Date() } },
      order: [['eventDate', 'ASC']],
      limit: 5,
      attributes: ['id', 'title', 'slug', 'eventDate', 'venue', 'availableTicket', 'maxAttendees'],
    });

    return {
      totalEvents,
      eventsByStatus,
      totalTicketsSold: parseInt(salesAgg.ticketsSold, 10) || 0,
      totalRevenue: parseFloat(salesAgg.revenue) || 0,
      totalVisitors,
      upcomingEvents,
    };
  }

  /**
   * DASH-02: Ringkasan dashboard admin — platform-wide. Di-cache (data
   * seluruh platform, wajar sedikit delay demi mengurangi beban query).
   */
  static async getAdminDashboard() {
    const cacheKey = 'admin:dashboard';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const usersByRoleRaw = await db.User.findAll({
      attributes: ['role', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true,
    });
    const usersByRole = { admin: 0, organizer: 0, customer: 0 };
    let totalUsers = 0;
    usersByRoleRaw.forEach((row) => {
      const count = parseInt(row.count, 10);
      usersByRole[row.role] = count;
      totalUsers += count;
    });

    const eventsByStatusRaw = await db.Event.findAll({
      attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    const eventsByStatus = { draft: 0, published: 0, closed: 0, cancelled: 0 };
    let totalEvents = 0;
    eventsByStatusRaw.forEach((row) => {
      const count = parseInt(row.count, 10);
      eventsByStatus[row.status] = count;
      totalEvents += count;
    });

    const ordersByStatusRaw = await db.Order.findAll({
      attributes: ['paymentStatus', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['paymentStatus'],
      raw: true,
    });
    const ordersByStatus = { pending: 0, paid: 0, expired: 0, cancelled: 0, refunded: 0 };
    let totalOrders = 0;
    ordersByStatusRaw.forEach((row) => {
      const count = parseInt(row.count, 10);
      ordersByStatus[row.paymentStatus] = count;
      totalOrders += count;
    });

    const [revenueAgg] = await db.Order.findAll({
      attributes: [
        [
          db.sequelize.fn('COALESCE', db.sequelize.fn('SUM', db.sequelize.col('total_amount')), 0),
          'revenue',
        ],
      ],
      where: { paymentStatus: 'paid' },
      raw: true,
    });

    const result = {
      totalUsers,
      usersByRole,
      totalEvents,
      eventsByStatus,
      totalOrders,
      ordersByStatus,
      totalRevenue: parseFloat(revenueAgg.revenue) || 0,
    };

    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  /**
   * DASH-03: Laporan penjualan organizer — breakdown per event + tren harian,
   * opsional difilter rentang tanggal (berdasarkan paid_at).
   */
  static async getSalesReport(organizerId, { startDate, endDate } = {}) {
    const dateFilter = [];
    const replacements = { organizerId };
    if (startDate) {
      dateFilter.push('o.paid_at >= :startDate');
      replacements.startDate = startDate;
    }
    if (endDate) {
      dateFilter.push('o.paid_at <= :endDate');
      replacements.endDate = endDate;
    }
    const dateClause = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

    const byEvent = await db.sequelize.query(
      `SELECT e.id AS eventId, e.title, COUNT(o.id) AS orderCount,
              COALESCE(SUM(o.quantity), 0) AS ticketsSold,
              COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE e.creator_id = :organizerId AND o.payment_status = 'paid' ${dateClause}
       GROUP BY e.id, e.title
       ORDER BY revenue DESC`,
      { replacements, type: QueryTypes.SELECT },
    );

    const byDay = await db.sequelize.query(
      `SELECT DATE(o.paid_at) AS date, COUNT(o.id) AS orderCount,
              COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE e.creator_id = :organizerId AND o.payment_status = 'paid' ${dateClause}
       GROUP BY DATE(o.paid_at)
       ORDER BY date ASC`,
      { replacements, type: QueryTypes.SELECT },
    );

    const totalRevenue = byEvent.reduce((sum, row) => sum + parseFloat(row.revenue), 0);
    const totalTicketsSold = byEvent.reduce((sum, row) => sum + parseInt(row.ticketsSold, 10), 0);

    return {
      summary: {
        totalRevenue,
        totalTicketsSold,
        totalOrders: byEvent.reduce((s, r) => s + parseInt(r.orderCount, 10), 0),
      },
      byEvent,
      byDay,
    };
  }

  /**
   * DASH-04: Performa per event milik organizer — list seluruh event dengan
   * metrik terjual/revenue/occupancy/check-in rate, untuk dibandingkan satu
   * sama lain (BEDA dengan EVT-12 yang detail SATU event spesifik).
   */
  static async getEventPerformanceReport(organizerId) {
    const salesByEvent = await db.sequelize.query(
      `SELECT e.id, e.title, e.status, e.event_date AS eventDate,
              e.max_attendees AS maxAttendees, e.available_ticket AS availableTicket,
              e.ticket_price AS ticketPrice,
              COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.quantity ELSE 0 END), 0) AS ticketsSold,
              COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS revenue
       FROM events e
       LEFT JOIN orders o ON o.event_id = e.id
       WHERE e.creator_id = :organizerId
       GROUP BY e.id
       ORDER BY e.event_date DESC`,
      { replacements: { organizerId }, type: QueryTypes.SELECT },
    );

    // Query terpisah dari orders (bukan digabung LEFT JOIN yang sama) supaya
    // tidak terjadi cartesian product antara baris orders x tickets per event.
    const checkinByEvent = await db.sequelize.query(
      `SELECT t.event_id AS eventId, COUNT(*) AS ticketsIssued,
              SUM(CASE WHEN t.is_checked_in THEN 1 ELSE 0 END) AS checkedIn
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE e.creator_id = :organizerId
       GROUP BY t.event_id`,
      { replacements: { organizerId }, type: QueryTypes.SELECT },
    );

    const checkinMap = {};
    checkinByEvent.forEach((row) => {
      checkinMap[row.eventId] = row;
    });

    return salesByEvent.map((event) => {
      const checkin = checkinMap[event.id];
      const ticketsIssued = checkin ? parseInt(checkin.ticketsIssued, 10) : 0;
      const checkedIn = checkin ? parseInt(checkin.checkedIn, 10) : 0;
      const maxAttendees = parseInt(event.maxAttendees, 10);
      const ticketsSold = parseInt(event.ticketsSold, 10);

      return {
        ...event,
        ticketsSold,
        revenue: parseFloat(event.revenue),
        ticketsIssued,
        checkedIn,
        occupancyRate: maxAttendees > 0 ? Number((ticketsSold / maxAttendees).toFixed(2)) : 0,
        checkInRate: ticketsIssued > 0 ? Number((checkedIn / ticketsIssued).toFixed(2)) : 0,
      };
    });
  }

  /**
   * DASH-05: Revenue platform — tren harian + breakdown per kategori.
   */
  static async getRevenueReport({ startDate, endDate } = {}) {
    const cacheKey = `admin:revenue:${startDate || ''}:${endDate || ''}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dateFilter = [];
    const replacements = {};
    if (startDate) {
      dateFilter.push('paid_at >= :startDate');
      replacements.startDate = startDate;
    }
    if (endDate) {
      dateFilter.push('paid_at <= :endDate');
      replacements.endDate = endDate;
    }
    const dateClause = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

    const byDay = await db.sequelize.query(
      `SELECT DATE(paid_at) AS date, COUNT(*) AS orderCount,
              COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE payment_status = 'paid' ${dateClause}
       GROUP BY DATE(paid_at)
       ORDER BY date ASC`,
      { replacements, type: QueryTypes.SELECT },
    );

    const byCategory = await db.sequelize.query(
      `SELECT c.name AS category, COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM orders o
       JOIN events e ON e.id = o.event_id
       JOIN categories c ON c.id = e.category_id
       WHERE o.payment_status = 'paid' ${dateClause.replace(/paid_at/g, 'o.paid_at')}
       GROUP BY c.name
       ORDER BY revenue DESC`,
      { replacements, type: QueryTypes.SELECT },
    );

    const totalRevenue = byDay.reduce((sum, row) => sum + parseFloat(row.revenue), 0);

    const result = { totalRevenue, byDay, byCategory };
    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  /**
   * DASH-06: Laporan user — breakdown role, tren registrasi, top organizer by revenue.
   */
  static async getUserReport({ startDate, endDate } = {}) {
    const cacheKey = `admin:users:${startDate || ''}:${endDate || ''}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const usersByRoleRaw = await db.User.findAll({
      attributes: ['role', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true,
    });
    const usersByRole = { admin: 0, organizer: 0, customer: 0 };
    usersByRoleRaw.forEach((row) => {
      usersByRole[row.role] = parseInt(row.count, 10);
    });

    const dateFilter = [];
    const replacements = {};
    if (startDate) {
      dateFilter.push('created_at >= :startDate');
      replacements.startDate = startDate;
    }
    if (endDate) {
      dateFilter.push('created_at <= :endDate');
      replacements.endDate = endDate;
    }
    const dateClause = dateFilter.length ? `WHERE ${dateFilter.join(' AND ')}` : '';

    const registrationTrend = await db.sequelize.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS newUsers
       FROM users ${dateClause}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { replacements, type: QueryTypes.SELECT },
    );

    const topOrganizers = await db.sequelize.query(
      `SELECT u.id, u.name, u.email,
              COUNT(DISTINCT e.id) AS totalEvents,
              COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS revenue
       FROM users u
       JOIN events e ON e.creator_id = u.id
       LEFT JOIN orders o ON o.event_id = e.id
       WHERE u.role = 'organizer'
       GROUP BY u.id, u.name, u.email
       ORDER BY revenue DESC
       LIMIT 10`,
      { type: QueryTypes.SELECT },
    );

    const result = { usersByRole, registrationTrend, topOrganizers };
    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  /**
   * DASH-07: Laporan pembayaran — breakdown status payment & metode pembayaran.
   */
  static async getPaymentReport({ startDate, endDate } = {}) {
    const cacheKey = `admin:payments:${startDate || ''}:${endDate || ''}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dateFilter = [];
    const replacements = {};
    if (startDate) {
      dateFilter.push('p.created_at >= :startDate');
      replacements.startDate = startDate;
    }
    if (endDate) {
      dateFilter.push('p.created_at <= :endDate');
      replacements.endDate = endDate;
    }
    const dateClause = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

    const byStatus = await db.sequelize.query(
      `SELECT p.status, COUNT(*) AS count,
              COALESCE(SUM(o.total_amount), 0) AS totalAmount
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE 1=1 ${dateClause}
       GROUP BY p.status`,
      { replacements, type: QueryTypes.SELECT },
    );

    const byMethod = await db.sequelize.query(
      `SELECT payment_method AS method, COUNT(*) AS count,
              COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE payment_status = 'paid' AND payment_method IS NOT NULL
       GROUP BY payment_method
       ORDER BY revenue DESC`,
      { type: QueryTypes.SELECT },
    );

    const result = { byStatus, byMethod };
    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }
}

module.exports = DashboardService;
