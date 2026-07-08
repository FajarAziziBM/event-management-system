// src/routes/api/v1/index.js

'use strict';

const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { title: 'Beranda' });
});

module.exports = router;
