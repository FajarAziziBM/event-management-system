// src/utils/signQrPayload.js
'use strict';

const crypto = require('node:crypto');

const config = require('../config/env');

// Domain-separation: turunan dari JWT_SECRET dengan salt tetap, bukan reuse
// mentah-mentah, supaya kebocoran satu mekanisme tidak otomatis membongkar yang lain.
const QR_SIGNING_KEY = `${config.auth.jwtSecret}:ticket-qr`;

/**
 * qr_code = "{ticket_code}.{signature 16 hex}" — signature inilah yang di-encode
 * jadi gambar QR sungguhan nanti di Epic TIX (pakai package `qrcode`).
 */
function signQrPayload(ticketCode) {
  const signature = crypto
    .createHmac('sha256', QR_SIGNING_KEY)
    .update(ticketCode)
    .digest('hex')
    .slice(0, 16);

  return `${ticketCode}.${signature}`;
}

function verifyQrPayload(qrPayload) {
  if (typeof qrPayload !== 'string' || !qrPayload.includes('.')) return false;

  const [ticketCode, signature] = qrPayload.split('.');
  if (!ticketCode || !signature) return false;

  const expected = signQrPayload(ticketCode).split('.')[1];
  return signature === expected;
}

module.exports = { signQrPayload, verifyQrPayload };
