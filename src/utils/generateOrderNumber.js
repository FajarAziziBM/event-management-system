// src/utils/generateOrderNumber.js
'use strict';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * ORD-02: Format ORD-{YYYYMMDD}-{6 karakter acak alfanumerik}, mis. ORD-20260706-8F3K2A.
 * Keunikan sesungguhnya dijamin lewat retry-check di service layer (lihat
 * OrderService._generateUniqueOrderNumber) + constraint UNIQUE di kolom DB
 * sebagai jaring pengaman terakhir.
 */
function generateOrderNumber(date = new Date()) {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');

  let random = '';
  for (let i = 0; i < 6; i += 1) {
    random += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }

  return `ORD-${datePart}-${random}`;
}

module.exports = generateOrderNumber;
