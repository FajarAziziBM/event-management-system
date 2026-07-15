// src/routes/webhooks/xendit.js
'use strict';

const express = require('express');

const XenditWebhookController = require('../../controllers/webhooks/xendit.controller');
const { verifyXenditWebhook } = require('../../middlewares/verifyXenditWebhook.middleware');

const router = express.Router();

// PAY-06: verifikasi token menggantikan authenticate JWT biasa — Xendit bukan
// user kita, tidak punya cookie/JWT, hanya kirim x-callback-token statis.
router.post('/', verifyXenditWebhook, XenditWebhookController.receive);

module.exports = router;
