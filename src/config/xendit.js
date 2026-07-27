// src/config/xendit.js
'use strict';

const { Xendit } = require('xendit-node');

const config = require('./env');

console.log('XENDIT DEBUG:', {
  exists: !!config.xendit.secretKey,
  length: config.xendit.secretKey?.length,
  prefix: config.xendit.secretKey?.substring(0, 15),
});

const xenditClient = new Xendit({ secretKey: config.xendit.secretKey });
const { Invoice } = xenditClient;

module.exports = { xenditClient, Invoice };
