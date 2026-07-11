'use strict';

const express = require('express');
const ApiResponse = require('../../../utils/ApiResponse');

const router = express.Router();

const authRoute = require('./auth');

router.use('/auth', authRoute);

router.get('/health', (req, res) => {
  res.json(
    ApiResponse.success('OK', {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );
});

module.exports = router;
