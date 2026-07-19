// src/config/mailer.js
'use strict';

const nodemailer = require('nodemailer');

const config = require('./env');

/**
 * Saat NODE_ENV=test, pakai jsonTransport bawaan Nodemailer: seluruh pipeline
 * (render EJS, format pesan, "pengiriman") tetap berjalan asli, TAPI tidak
 * pernah menyentuh jaringan SMTP sama sekali — cocok untuk sandbox/CI yang
 * memang tidak diberi akses ke server SMTP manapun. Hasil "kiriman" tetap
 * bisa diinspeksi lewat info.message (JSON string) di test.
 */
const transporter = config.isTest
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465, // 465 = implicit TLS, selain itu STARTTLS/plain
      auth: config.mail.username
        ? { user: config.mail.username, pass: config.mail.password }
        : undefined,
    });

module.exports = transporter;
