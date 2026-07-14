// src/config/xendit.js
'use strict';

const { Xendit } = require('xendit-node');

const config = require('./env');

const xenditClient = new Xendit({ secretKey: config.xendit.secretKey });
const { Invoice } = xenditClient;

module.exports = { xenditClient, Invoice };