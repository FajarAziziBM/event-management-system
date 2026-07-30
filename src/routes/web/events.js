// src/routes/web/events.js
'use strict';

const express = require('express');

const EventWebController = require('../../controllers/web/event.controller');
const { requireWebAuth, requireWebRole } = require('../../middlewares/webAuth.middleware');
const { uploadBanner } = require('../../middlewares/upload.middleware');
const { requireCsrf } = require('../../middlewares/csrf.middleware');
// SEC-04: reuse validator yang sama persis dengan yang dipakai API — satu
// sumber kebenaran untuk aturan validasi, tidak didefinisikan ulang di sini.
const {
  validateEventId,
  validateUnpublish,
  validateListQuery,
} = require('../../validations/event.validation');

const router = express.Router();

const organizerOnly = [requireWebAuth, requireWebRole('organizer', 'admin')];

// --- Rute spesifik dulu, SEBELUM /events/:slug (biar 'create' tidak ketangkap sebagai slug) ---
router.get('/events/create', ...organizerOnly, EventWebController.createForm);
router.post('/events/create', ...organizerOnly, requireCsrf, EventWebController.create);

// validateEventId ditaruh SEBELUM uploadBanner — :id (URL param) sudah bisa
// dicek duluan tanpa perlu nunggu multer parse body/file dulu.
router.get('/events/:id/edit', ...organizerOnly, validateEventId, EventWebController.editForm);
// SEC-06 PENTING: requireCsrf HARUS SETELAH uploadBanner di rute ini —
// req.body._csrf baru terisi setelah multer selesai mem-parsing multipart/form-data.
// Kalau dibalik urutannya, requireCsrf akan SELALU gagal (body masih kosong).
router.post(
  '/events/:id/edit',
  ...organizerOnly,
  validateEventId,
  uploadBanner,
  requireCsrf,
  EventWebController.update,
);
router.post(
  '/events/:id/publish',
  ...organizerOnly,
  requireCsrf,
  validateEventId,
  EventWebController.publish,
);
router.post(
  '/events/:id/unpublish',
  ...organizerOnly,
  requireCsrf,
  validateUnpublish,
  EventWebController.unpublish,
);
router.post(
  '/events/:id/delete',
  ...organizerOnly,
  requireCsrf,
  validateEventId,
  EventWebController.remove,
);

router.get('/my-events', ...organizerOnly, EventWebController.myEvents);

// --- Rute publik (paling umum, ditaruh paling akhir) ---
router.get('/events', validateListQuery, EventWebController.index);
router.get('/events/:slug', EventWebController.detail);

module.exports = router;
