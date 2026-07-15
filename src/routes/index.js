// src/routes/index.js
'use strict';

const express = require('express');

const webRoutes = require('./web');
const apiV1Routes = require('./api/v1');
const xenditWebhookRoutes = require('./webhooks/xendit');

const router = express.Router();

router.use('/api/v1', apiV1Routes);
// PAY-05: di luar namespace /api/v1 secara sengaja — webhook adalah kontrak
// jangka panjang dengan Xendit, tidak ikut skema versioning API internal kita.
router.use('/api/webhooks/xendit', xenditWebhookRoutes);
router.use('/', webRoutes);

module.exports = router;
