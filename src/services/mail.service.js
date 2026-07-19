// src/services/mail.service.js
'use strict';

const path = require('node:path');
const ejs = require('ejs');

const transporter = require('../config/mailer');
const config = require('../config/env');
const logger = require('../config/logger');

const TEMPLATES_DIR = path.join(__dirname, '..', 'views', 'emails');

class MailService {
  /**
   * NOTIF-01: Render template EJS lalu kirim lewat Nodemailer.
   *
   * Sengaja TIDAK PERNAH throw — kegagalan kirim email (SMTP down, dst) tidak
   * boleh menggagalkan alur bisnis utama (registrasi/pembayaran/dll tetap
   * sukses meski emailnya gagal terkirim). Kegagalan cukup dicatat di log
   * untuk investigasi, konsisten dengan pendekatan "best-effort" yang sudah
   * dipakai di epic-epic sebelumnya (mis. cleanup file saat delete event).
   */
  static async send({ to, subject, template, data = {} }) {
    let html;
    try {
      html = await ejs.renderFile(path.join(TEMPLATES_DIR, `${template}.ejs`), data);
    } catch (err) {
      logger.error('[mail] Gagal render template', { template, error: err.message });
      return null;
    }

    try {
      const info = await transporter.sendMail({
        from: config.mail.fromAddress,
        to,
        subject,
        html,
      });
      logger.info('[mail] Terkirim', { to, subject, template, messageId: info.messageId });
      return info;
    } catch (err) {
      logger.error('[mail] Gagal kirim', { to, subject, template, error: err.message });
      return null;
    }
  }
}

module.exports = MailService;
