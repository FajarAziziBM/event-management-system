// src/routes/web/index.js
'use strict';

const express = require('express');

const authRoutes = require('./auth');

const router = express.Router();

router.use('/auth', authRoutes);

router.get('/', (req, res) => {
  res.render('index', { title: 'Beranda' });
});

module.exports = router;
