// src/routes/web/index.js

'use strict';

'use strict';

const express = require('express');

const ApiResponse = require('../../utils/ApiResponse');
const authRoutes = require('./auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json(
    ApiResponse.success('OK', {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );
});

// Mount auth routes
router.use('/auth', authRoutes);

// Home
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Beranda',
  });
});

module.exports = router;
