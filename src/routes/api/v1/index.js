// src/routes/api/v1/index.js

'use strict';

const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');

router.use('/auth', authRoute);

router.get('/', (req, res) => {
  res.render('index', { title: 'Beranda' });
});

module.exports = router;
