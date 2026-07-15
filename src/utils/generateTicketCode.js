// src/utils/generateTicketCode.js
'use strict';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Format TIX-{event_id 6 digit}-{8 karakter acak}, mis. TIX-000123-9J2K7XQ4
 * (spesifikasi.md §4.2). Keunikan sesungguhnya dijamin lewat unique constraint
 * di kolom DB + retry di payment.service.js.
 */
function generateTicketCode(eventId) {
  const paddedEventId = String(eventId).padStart(6, '0');

  let random = '';
  for (let i = 0; i < 8; i += 1) {
    random += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }

  return `TIX-${paddedEventId}-${random}`;
}

module.exports = generateTicketCode;
