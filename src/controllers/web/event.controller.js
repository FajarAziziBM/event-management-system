// src/controllers/web/event.controller.js
'use strict';

const EventService = require('../../services/event.service');
const CategoryService = require('../../services/category.service');
const DashboardService = require('../../services/dashboard.service');
const { setFlash } = require('../../utils/flash');

/** Ambil pesan yang enak dibaca dari error apa pun (custom AppError atau SequelizeValidationError). */
function friendlyMessage(err) {
  if (err.name === 'SequelizeValidationError' && Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => e.message).join(', ');
  }
  return err.message || 'Terjadi kesalahan, silakan coba lagi.';
}

/** Validasi ringan di sisi web (bukan pengganti aturan bisnis di service, hanya penjaga UX form). */
function validateEventForm(body) {
  const errors = {};
  const title = (body.title || '').trim();
  const description = (body.description || '').trim();
  const venue = (body.venue || '').trim();
  const address = (body.address || '').trim();

  if (title.length < 5 || title.length > 200) {
    errors.title = 'Judul wajib diisi, 5-200 karakter';
  }
  if (description.length < 20) {
    errors.description = 'Deskripsi minimal 20 karakter';
  }
  if (!venue) {
    errors.venue = 'Venue wajib diisi';
  }
  if (!address) {
    errors.address = 'Alamat wajib diisi';
  }
  if (!body.categoryId) {
    errors.categoryId = 'Kategori wajib dipilih';
  }
  if (!body.eventDate) {
    errors.eventDate = 'Tanggal mulai wajib diisi';
  }
  if (!body.eventEndDate) {
    errors.eventEndDate = 'Tanggal selesai wajib diisi';
  } else if (body.eventDate && new Date(body.eventEndDate) <= new Date(body.eventDate)) {
    errors.eventEndDate = 'Tanggal selesai harus setelah tanggal mulai';
  }
  const maxAttendees = parseInt(body.maxAttendees, 10);
  if (!maxAttendees || maxAttendees < 1) {
    errors.maxAttendees = 'Kapasitas minimal 1 orang';
  }
  const ticketPrice = parseFloat(body.ticketPrice);
  if (Number.isNaN(ticketPrice) || ticketPrice < 0) {
    errors.ticketPrice = 'Harga tiket tidak valid';
  }

  return {
    errors,
    data: {
      title,
      description,
      venue,
      address,
      categoryId: body.categoryId,
      eventDate: body.eventDate,
      eventEndDate: body.eventEndDate,
      maxAttendees,
      ticketPrice,
    },
  };
}

const EventWebController = {
  /** EVT-09/11: GET /events — jelajahi/cari event publik */
  async index(req, res, next) {
    try {
      const filters = {
        search: req.query.q || req.query.search || undefined,
        category: req.query.category || undefined,
        location: req.query.location || undefined,
        dateFrom: req.query.dateFrom || undefined,
        dateTo: req.query.dateTo || undefined,
        page: req.query.page || 1,
        limit: 9,
      };
      const [{ events, pagination }, categories] = await Promise.all([
        EventService.listPublicEvents(filters),
        CategoryService.getAllCategories(),
      ]);

      res.render('events/index', {
        title: 'Jelajahi Event',
        activeNav: 'events',
        events,
        pagination,
        categories,
        filters: req.query,
      });
    } catch (err) {
      next(err);
    }
  },

  /** EVT-10: GET /events/:slug — detail event publik */
  async detail(req, res, next) {
    try {
      const event = await EventService.getEventBySlug(req.params.slug, req.user);
      const isOwner =
        req.user && (req.user.role === 'admin' || String(event.creatorId) === String(req.user.id));

      res.render('events/detail', {
        title: event.title,
        activeNav: 'events',
        event,
        isOwner,
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /my-events — daftar & kelola event milik organizer/admin yang login */
  async myEvents(req, res, next) {
    try {
      const filters = { status: req.query.status || undefined, page: req.query.page || 1 };
      const [{ events, pagination }, dashboard] = await Promise.all([
        EventService.listEventsByCreator(req.user.id, filters),
        DashboardService.getOrganizerDashboard(req.user.id).catch(() => null),
      ]);

      res.render('events/my-events', {
        title: 'Event Saya',
        events,
        pagination,
        dashboard,
        activeStatus: filters.status || 'all',
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /events/create */
  async createForm(req, res, next) {
    try {
      const categories = await CategoryService.getAllCategories();
      res.render('events/create', {
        title: 'Buat Event Baru',
        categories,
        values: {},
        errors: {},
      });
    } catch (err) {
      next(err);
    }
  },

  /** POST /events/create */
  async create(req, res, next) {
    try {
      const { errors, data } = validateEventForm(req.body);

      if (Object.keys(errors).length > 0) {
        const categories = await CategoryService.getAllCategories();
        return res.status(422).render('events/create', {
          title: 'Buat Event Baru',
          categories,
          values: req.body,
          errors,
        });
      }

      const event = await EventService.createEvent(req.user.id, data);
      setFlash(
        res,
        'success',
        'Event berhasil dibuat sebagai draft. Yuk lengkapi banner-nya di bawah, lalu publikasikan kalau sudah siap.',
      );
      return res.redirect(`/events/${event.id}/edit`);
    } catch (err) {
      try {
        const categories = await CategoryService.getAllCategories();
        return res.status(422).render('events/create', {
          title: 'Buat Event Baru',
          categories,
          values: req.body,
          errors: { _general: friendlyMessage(err) },
        });
      } catch (innerErr) {
        return next(innerErr);
      }
    }
  },

  /** GET /events/:id/edit */
  async editForm(req, res, next) {
    try {
      const [event, categories] = await Promise.all([
        EventService.getEventForOwner(req.params.id, req.user.id, req.user.role),
        CategoryService.getAllCategories(),
      ]);

      res.render('events/edit', {
        title: `Edit ${event.title}`,
        event,
        categories,
        values: {
          title: event.title,
          description: event.description,
          venue: event.venue,
          address: event.address,
          categoryId: event.categoryId,
          eventDate: event.eventDate,
          eventEndDate: event.eventEndDate,
          maxAttendees: event.maxAttendees,
          ticketPrice: event.ticketPrice,
        },
        errors: {},
      });
    } catch (err) {
      next(err);
    }
  },

  /** POST /events/:id/edit — form gabungan: detail + (opsional) banner dalam satu submit */
  async update(req, res, next) {
    try {
      const { errors, data } = validateEventForm(req.body);

      if (Object.keys(errors).length > 0) {
        const [event, categories] = await Promise.all([
          EventService.getEventForOwner(req.params.id, req.user.id, req.user.role),
          CategoryService.getAllCategories(),
        ]);
        return res.status(422).render('events/edit', {
          title: `Edit ${event.title}`,
          event,
          categories,
          values: req.body,
          errors,
        });
      }

      await EventService.updateEvent(req.params.id, req.user.id, req.user.role, data);

      if (req.file) {
        await EventService.uploadBanner(req.params.id, req.user.id, req.user.role, req.file);
      }

      setFlash(res, 'success', 'Perubahan event berhasil disimpan.');
      return res.redirect(`/events/${req.params.id}/edit`);
    } catch (err) {
      try {
        const [event, categories] = await Promise.all([
          EventService.getEventForOwner(req.params.id, req.user.id, req.user.role),
          CategoryService.getAllCategories(),
        ]);
        return res.status(422).render('events/edit', {
          title: `Edit ${event.title}`,
          event,
          categories,
          values: req.body,
          errors: { _general: friendlyMessage(err) },
        });
      } catch (innerErr) {
        return next(innerErr);
      }
    }
  },

  /** POST /events/:id/publish */
  async publish(req, res, next) {
    try {
      await EventService.publishEvent(req.params.id, req.user.id, req.user.role);
      setFlash(res, 'success', 'Event berhasil dipublikasikan dan sekarang terlihat oleh publik.');
    } catch (err) {
      setFlash(res, 'error', friendlyMessage(err));
    }
    res.redirect('/my-events');
  },

  /** POST /events/:id/unpublish — targetStatus: draft | closed | cancelled (divalidasi di routes) */
  async unpublish(req, res, next) {
    try {
      const targetStatus = req.body.targetStatus || 'draft';
      await EventService.unpublishEvent(req.params.id, req.user.id, req.user.role, targetStatus);
      const messages = {
        draft: 'Event ditarik kembali ke draft.',
        closed: 'Event ditutup (tidak menerima pemesanan baru).',
        cancelled: 'Event dibatalkan. Seluruh pemegang tiket telah diberi notifikasi.',
      };
      setFlash(res, 'success', messages[targetStatus]);
    } catch (err) {
      setFlash(res, 'error', friendlyMessage(err));
    }
    res.redirect('/my-events');
  },

  /** POST /events/:id/delete */
  async remove(req, res, next) {
    try {
      await EventService.deleteEvent(req.params.id, req.user.id, req.user.role);
      setFlash(res, 'success', 'Event berhasil dihapus.');
    } catch (err) {
      setFlash(res, 'error', friendlyMessage(err));
    }
    res.redirect('/my-events');
  },
};

module.exports = EventWebController;
