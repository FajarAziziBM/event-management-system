// src/routes/web/events.js
'use strict';

const express = require('express');

const EventWebController = require('../../controllers/web/event.controller');
const { requireWebAuth, requireWebRole } = require('../../middlewares/webAuth.middleware');
const { uploadBanner } = require('../../middlewares/upload.middleware');

const router = express.Router();

const organizerOnly = [requireWebAuth, requireWebRole('organizer', 'admin')];

// --- Rute spesifik dulu, SEBELUM /events/:slug (biar 'create' tidak ketangkap sebagai slug) ---
router.get('/events/create', ...organizerOnly, EventWebController.createForm);
router.post('/events/create', ...organizerOnly, EventWebController.create);

router.get('/events/:id/edit', ...organizerOnly, EventWebController.editForm);
router.post('/events/:id/edit', ...organizerOnly, uploadBanner, EventWebController.update);
router.post('/events/:id/publish', ...organizerOnly, EventWebController.publish);
router.post('/events/:id/unpublish', ...organizerOnly, EventWebController.unpublish);
router.post('/events/:id/delete', ...organizerOnly, EventWebController.remove);

router.get('/my-events', ...organizerOnly, EventWebController.myEvents);

// --- Rute publik (paling umum, ditaruh paling akhir) ---
router.get('/events', EventWebController.index);
router.get('/events/:slug', EventWebController.detail);

module.exports = router;
