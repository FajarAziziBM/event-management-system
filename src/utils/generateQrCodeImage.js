// src/utils/generateQrCodeImage.js
'use strict';

const QRCode = require('qrcode');

const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 1, width: 300 };

/**
 * TIX-02: Encode payload qr_code (ticket_code.signature) jadi gambar QR.
 * - Data URL dipakai di response JSON (TIX-03) — langsung bisa <img src="...">
 * - Buffer dipakai untuk ditempel ke dalam PDF (TIX-04)
 */
async function generateQrCodeDataUrl(payload) {
  return QRCode.toDataURL(payload, QR_OPTIONS);
}

async function generateQrCodeBuffer(payload) {
  return QRCode.toBuffer(payload, QR_OPTIONS);
}

module.exports = { generateQrCodeDataUrl, generateQrCodeBuffer };
