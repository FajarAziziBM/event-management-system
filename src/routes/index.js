// src/routes/index.js
'use strict';

const express = require('express');

const webRoutes = require('./web');
const apiV1Routes = require('./api/v1');

const router = express.Router();

router.use('/api/v1', apiV1Routes);
router.use('/', webRoutes);

module.exports = router;
