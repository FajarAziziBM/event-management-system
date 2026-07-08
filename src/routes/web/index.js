// src/routes/web/index.js

'use strict';

'use strict';

const express = require('express');
const ApiResponse = require('../../utils/ApiResponse');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json(
    ApiResponse.success('OK', {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );
});

module.exports = router;
