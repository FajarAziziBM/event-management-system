// src/services/event.service.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');

const db = require('../models');
const NotificationService = require('./notification.service');
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} = require('../utils/errors');

/** Kolom yang aman untuk publik (jangan expose data internal creator secara berlebihan) */
const PUBLIC_EVENT_INCLUDE = [
  { model: db.Category, as: 'category', attributes: ['id', 'name', 'icon'] },
  { model: db.User, as: 'creator', attributes: ['id', 'name'] },
];

class EventService {
  /**
   * Lempar ForbiddenError kecuali user adalah admin ATAU pemilik event (creatorId cocok).
   */
  static _assertOwnership(event, userId, userRole) {
    if (userRole === 'admin') return;
    // req.user.id dari JWT vs event.creatorId dari DB (BIGINT) — bandingkan sebagai string
    if (String(event.creatorId) !== String(userId)) {
      throw new ForbiddenError('Anda bukan pemilik event ini');
    }
  }

  static async _findEventOrThrow(id) {
    const event = await db.Event.findByPk(id);
    if (!event) {
      throw new NotFoundError('Event tidak ditemukan');
    }
    return event;
  }

  static _safeUnlink(relativePath) {
    if (!relativePath) return;
    try {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch {
      // Abaikan — file mungkin memang tidak pernah ada fisiknya (mis. data seed)
    }
  }

  /**
   * EVT-01: Buat event baru — status awal SELALU 'draft' (per spesifikasi),
   * available_ticket diinisialisasi sama dengan max_attendees.
   */
  static async createEvent(creatorId, data) {
    const category = await db.Category.findByPk(data.categoryId);
    if (!category) {
      throw new ValidationError('Kategori tidak ditemukan', { categoryId: 'Kategori tidak valid' });
    }

    const event = await db.Event.create({
      creatorId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      venue: data.venue,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      eventDate: data.eventDate,
      eventEndDate: data.eventEndDate,
      maxAttendees: data.maxAttendees,
      ticketPrice: data.ticketPrice,
      availableTicket: data.maxAttendees, // awal = kapasitas penuh
      status: 'draft',
    });

    // NOTIF-05: alert internal ke admin — event baru dibuat
    const organizer = await db.User.findByPk(creatorId, { attributes: ['id', 'name', 'email'] });
    await NotificationService.notifyAdminNewEvent(event, organizer);

    return event;
  }

  /**
   * EVT-02: Edit event — hanya pemilik/admin. available_ticket disesuaikan
   * otomatis jika max_attendees berubah (bukan diubah langsung oleh caller).
   * NOTIF-04: perubahan pada field signifikan (tanggal/venue/alamat)
   * dinotifikasi ke seluruh pemegang tiket event ini.
   */
  static async updateEvent(id, userId, userRole, data) {
    const event = await this._findEventOrThrow(id);
    this._assertOwnership(event, userId, userRole);

    if (data.categoryId) {
      const category = await db.Category.findByPk(data.categoryId);
      if (!category) {
        throw new ValidationError('Kategori tidak ditemukan', {
          categoryId: 'Kategori tidak valid',
        });
      }
    }

    const updatePayload = { ...data };
    if (data.maxAttendees !== undefined && data.maxAttendees !== event.maxAttendees) {
      const diff = data.maxAttendees - event.maxAttendees;
      const newAvailable = event.availableTicket + diff;
      if (newAvailable < 0) {
        throw new ValidationError('max_attendees baru lebih kecil dari tiket yang sudah terjual', {
          maxAttendees: 'Tidak boleh lebih kecil dari jumlah tiket yang sudah terjual',
        });
      }
      updatePayload.availableTicket = newAvailable;
    }

    // NOTIF-04: rekam nilai field signifikan SEBELUM update untuk dibandingkan
    const SIGNIFICANT_FIELDS = {
      eventDate: 'Tanggal mulai',
      eventEndDate: 'Tanggal selesai',
      venue: 'Venue',
      address: 'Alamat',
    };
    const oldValues = {};
    Object.keys(SIGNIFICANT_FIELDS).forEach((field) => {
      oldValues[field] = event[field] ? String(event[field]) : null;
    });

    await event.update(updatePayload);

    const changes = [];
    Object.entries(SIGNIFICANT_FIELDS).forEach(([field, label]) => {
      if (data[field] === undefined) return;
      const newValue = event[field] ? String(event[field]) : null;
      if (newValue !== oldValues[field]) {
        changes.push(`${label} berubah menjadi: ${event[field]}`);
      }
    });

    if (changes.length > 0) {
      // Fungsi ini sendiri mengambil daftar pemegang tiket; kalau kosong
      // (belum ada yang beli/event masih draft), Promise.all-nya otomatis no-op.
      await NotificationService.sendEventUpdated(event, changes);
    }

    return event;
  }

  /**
   * EVT-03: Hapus event — hanya pemilik/admin. Tolak jika masih ada order (FK RESTRICT),
   * dan bersihkan file banner + lampiran fisik di disk sebelum menghapus record.
   */
  static async deleteEvent(id, userId, userRole) {
    const event = await this._findEventOrThrow(id);
    this._assertOwnership(event, userId, userRole);

    const attachments = await db.EventAttachment.findAll({ where: { eventId: id } });

    try {
      await event.destroy();
    } catch (err) {
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        throw new ConflictError('Event tidak bisa dihapus karena masih memiliki order');
      }
      throw err;
    }

    // Best-effort cleanup file fisik — kegagalan hapus file tidak boleh membatalkan
    // transaksi DB yang sudah sukses (file orphan lebih baik daripada data tidak konsisten).
    this._safeUnlink(event.imagePath);
    attachments.forEach((att) => this._safeUnlink(att.filePath));

    return { id: event.id, title: event.title };
  }

  /**
   * EVT-04: draft -> published
   */
  static async publishEvent(id, userId, userRole) {
    const event = await this._findEventOrThrow(id);
    this._assertOwnership(event, userId, userRole);

    if (event.status !== 'draft') {
      throw new ConflictError(
        `Event berstatus '${event.status}', hanya event 'draft' yang bisa dipublikasikan`,
      );
    }

    await event.update({ status: 'published' });
    return event;
  }

  /**
   * EVT-05: published -> draft / closed / cancelled (ditentukan targetStatus)
   * NOTIF-04: transisi ke 'cancelled' memicu notifikasi ke seluruh pemegang tiket.
   */
  static async unpublishEvent(id, userId, userRole, targetStatus = 'draft') {
    const event = await this._findEventOrThrow(id);
    this._assertOwnership(event, userId, userRole);

    if (event.status !== 'published') {
      throw new ConflictError(
        `Event berstatus '${event.status}', hanya event 'published' yang bisa di-unpublish`,
      );
    }

    await event.update({ status: targetStatus });

    if (targetStatus === 'cancelled') {
      await NotificationService.sendEventCancelled(event);
    }

    return event;
  }

  /**
   * EVT-06: Upload/replace banner event
   */
  static async uploadBanner(id, userId, userRole, file) {
    const event = await this._findEventOrThrow(id);
    this._assertOwnership(event, userId, userRole);

    if (!file) {
      throw new ValidationError('File banner wajib diupload');
    }

    this._safeUnlink(event.imagePath); // ganti banner lama jika ada

    const relativePath = path.relative(process.cwd(), file.path);
    await event.update({ imagePath: relativePath });

    return event;
  }

  /**
   * EVT-07: Upload lampiran event (bisa lebih dari satu per event)
   */
  static async uploadAttachment(eventId, userId, userRole, file) {
    const event = await this._findEventOrThrow(eventId);
    this._assertOwnership(event, userId, userRole);

    if (!file) {
      throw new ValidationError('File lampiran wajib diupload');
    }

    const relativePath = path.relative(process.cwd(), file.path);
    const attachment = await db.EventAttachment.create({
      eventId,
      fileName: file.originalname,
      filePath: relativePath,
      fileType: file.mimetype,
    });

    return attachment;
  }

  /**
   * EVT-08: Hapus lampiran — cek kepemilikan lewat event induknya
   */
  static async deleteAttachment(attachmentId, userId, userRole) {
    const attachment = await db.EventAttachment.findByPk(attachmentId);
    if (!attachment) {
      throw new NotFoundError('Lampiran tidak ditemukan');
    }

    const event = await this._findEventOrThrow(attachment.eventId);
    this._assertOwnership(event, userId, userRole);

    this._safeUnlink(attachment.filePath);
    await attachment.destroy();

    return { id: attachment.id, fileName: attachment.fileName };
  }

  /**
   * EVT-09 & EVT-11: List event publik — hanya status 'published', dengan
   * pagination dan filter (nama, kategori, rentang tanggal, lokasi, rentang harga).
   */
  static async listPublicEvents(filters = {}) {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 12, 1), 100);
    const offset = (page - 1) * limit;

    const where = { status: 'published' };

    if (filters.search) {
      where.title = { [Op.like]: `%${filters.search}%` };
    }
    if (filters.category) {
      where.categoryId = filters.category;
    }
    if (filters.location) {
      where.venue = { [Op.like]: `%${filters.location}%` };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.eventDate = {};
      if (filters.dateFrom) where.eventDate[Op.gte] = new Date(filters.dateFrom);
      if (filters.dateTo) where.eventDate[Op.lte] = new Date(filters.dateTo);
    }
    if (filters.minPrice || filters.maxPrice) {
      where.ticketPrice = {};
      if (filters.minPrice) where.ticketPrice[Op.gte] = filters.minPrice;
      if (filters.maxPrice) where.ticketPrice[Op.lte] = filters.maxPrice;
    }

    const { count, rows } = await db.Event.findAndCountAll({
      where,
      include: PUBLIC_EVENT_INCLUDE,
      order: [['eventDate', 'ASC']],
      limit,
      offset,
    });

    return {
      events: rows,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * EVT-10: Detail event publik by slug.
   * 'published'/'closed' terbuka untuk siapa saja; 'draft'/'cancelled' hanya
   * terlihat oleh pemilik/admin (mencegah unpublished event bocor lewat slug).
   */
  static async getEventBySlug(slug, currentUser) {
    const event = await db.Event.findOne({
      where: { slug },
      include: [...PUBLIC_EVENT_INCLUDE, { model: db.EventAttachment, as: 'attachments' }],
    });

    if (!event) {
      throw new NotFoundError('Event tidak ditemukan');
    }

    const isVisibleToPublic = ['published', 'closed'].includes(event.status);
    const isOwnerOrAdmin =
      currentUser &&
      (currentUser.role === 'admin' || String(event.creatorId) === String(currentUser.id));

    if (!isVisibleToPublic && !isOwnerOrAdmin) {
      throw new NotFoundError('Event tidak ditemukan');
    }

    return event;
  }

  /**
   * EVT-12: Statistik per event — hanya pemilik/admin
   */
  static async getEventStatistics(id, userId, userRole) {
    const event = await this._findEventOrThrow(id);
    this._assertOwnership(event, userId, userRole);

    const orders = await db.Order.findAll({ where: { eventId: id }, raw: true });

    const ordersByStatus = { pending: 0, paid: 0, expired: 0, cancelled: 0, refunded: 0 };
    let totalRevenue = 0;
    let totalTicketsSold = 0;

    orders.forEach((order) => {
      ordersByStatus[order.paymentStatus] = (ordersByStatus[order.paymentStatus] || 0) + 1;
      if (order.paymentStatus === 'paid') {
        totalRevenue += parseFloat(order.totalAmount);
        totalTicketsSold += order.quantity;
      }
    });

    const checkedInCount = await db.Ticket.count({ where: { eventId: id, isCheckedIn: true } });
    const totalTickets = await db.Ticket.count({ where: { eventId: id } });

    return {
      eventId: event.id,
      title: event.title,
      status: event.status,
      maxAttendees: event.maxAttendees,
      availableTicket: event.availableTicket,
      totalOrders: orders.length,
      ordersByStatus,
      totalTicketsSold,
      totalRevenue,
      totalTicketsIssued: totalTickets,
      checkedInCount,
      checkInRate: totalTickets > 0 ? Number((checkedInCount / totalTickets).toFixed(2)) : 0,
    };
  }
}

module.exports = EventService;
