// src/routes/api/v1/index.js
'use strict';

const express = require('express');

const ApiResponse = require('../../../utils/ApiResponse');
const authRoutes = require('./auth');
const categoryRoutes = require('./category');
const eventRoutes = require('./event');
const attachmentRoutes = require('./attachment');
const organizerRoutes = require('./organizer');
const orderRoutes = require('./order');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/events', eventRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/orders', orderRoutes);
router.use('/organizer', organizerRoutes);

router.get('/health', (req, res) => {
  res.json(
    ApiResponse.success('OK', {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );
});

module.exports = router;
