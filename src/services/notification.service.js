// src/services/notification.service.js
'use strict';

const db = require('../models');
const config = require('../config/env');
const MailService = require('./mail.service');

class NotificationService {
  static async _getAdminEmails() {
    const admins = await db.User.findAll({
      where: { role: 'admin', isSuspended: false },
      attributes: ['email'],
      raw: true,
    });
    return admins.map((a) => a.email);
  }

  /** Dedup attendeeEmail — satu orang bisa punya beberapa tiket untuk event yang sama */
  static async _getTicketHolders(eventId) {
    const tickets = await db.Ticket.findAll({
      where: { eventId },
      attributes: ['attendeeEmail', 'attendeeName'],
      raw: true,
    });

    const uniqueMap = new Map();
    tickets.forEach((t) => {
      if (t.attendeeEmail && !uniqueMap.has(t.attendeeEmail)) {
        uniqueMap.set(t.attendeeEmail, t.attendeeName);
      }
    });

    return Array.from(uniqueMap.entries()).map(([email, name]) => ({ email, name }));
  }

  /** NOTIF-02: registrasi berhasil */
  static async sendRegistrationSuccess(user) {
    return MailService.send({
      to: user.email,
      subject: 'Selamat Datang di Event Management System!',
      template: 'registration-success',
      data: { name: user.name, appUrl: config.app.url },
    });
  }

  /** Melengkapi AUTH-04 (forgot password) — sebelumnya masih TODO, diselesaikan di sini */
  static async sendPasswordReset(user, resetToken) {
    const resetUrl = `${config.app.url}/auth/reset-password?token=${resetToken}`;
    return MailService.send({
      to: user.email,
      subject: 'Reset Password Akun Anda',
      template: 'password-reset',
      data: { name: user.name, resetUrl },
    });
  }

  /** NOTIF-03: pembayaran berhasil */
  static async sendPaymentSuccess({
    email,
    name,
    orderId,
    orderNumber,
    eventTitle,
    quantity,
    totalAmount,
  }) {
    return MailService.send({
      to: email,
      subject: `Pembayaran Berhasil - ${eventTitle}`,
      template: 'payment-success',
      data: {
        name,
        orderId,
        orderNumber,
        eventTitle,
        quantity,
        totalAmount,
        appUrl: config.app.url,
      },
    });
  }

  /** NOTIF-03: pembayaran gagal */
  static async sendPaymentFailed({ email, name, orderNumber, eventTitle }) {
    return MailService.send({
      to: email,
      subject: `Pembayaran Gagal - ${eventTitle}`,
      template: 'payment-failed',
      data: { name, orderNumber, eventTitle, appUrl: config.app.url },
    });
  }

  /** NOTIF-03: pembayaran kedaluwarsa */
  static async sendPaymentExpired({ email, name, orderNumber, eventTitle }) {
    return MailService.send({
      to: email,
      subject: `Pembayaran Kedaluwarsa - ${eventTitle}`,
      template: 'payment-expired',
      data: { name, orderNumber, eventTitle, appUrl: config.app.url },
    });
  }

  /** NOTIF-04: event diperbarui — dikirim ke semua pemegang tiket event ini */
  static async sendEventUpdated(event, changes) {
    const holders = await this._getTicketHolders(event.id);

    return Promise.all(
      holders.map((holder) =>
        MailService.send({
          to: holder.email,
          subject: `Pembaruan Event: ${event.title}`,
          template: 'event-updated',
          data: {
            name: holder.name,
            eventTitle: event.title,
            eventSlug: event.slug,
            changes,
            appUrl: config.app.url,
          },
        }),
      ),
    );
  }

  /** NOTIF-04: event dibatalkan — dikirim ke semua pemegang tiket event ini */
  static async sendEventCancelled(event) {
    const holders = await this._getTicketHolders(event.id);

    return Promise.all(
      holders.map((holder) =>
        MailService.send({
          to: holder.email,
          subject: `Event Dibatalkan: ${event.title}`,
          template: 'event-cancelled',
          data: { name: holder.name, eventTitle: event.title },
        }),
      ),
    );
  }

  /** NOTIF-05: alert internal — organizer baru */
  static async notifyAdminNewOrganizer(user) {
    const adminEmails = await this._getAdminEmails();
    return Promise.all(
      adminEmails.map((email) =>
        MailService.send({
          to: email,
          subject: '[Admin] Organizer Baru Terdaftar',
          template: 'admin-alert',
          data: {
            alertTitle: 'Organizer Baru',
            alertMessage: `User "${user.name}" (${user.email}) kini berperan sebagai organizer.`,
          },
        }),
      ),
    );
  }

  /** NOTIF-05: alert internal — event baru dibuat */
  static async notifyAdminNewEvent(event, organizer) {
    const adminEmails = await this._getAdminEmails();
    return Promise.all(
      adminEmails.map((email) =>
        MailService.send({
          to: email,
          subject: '[Admin] Event Baru Dibuat',
          template: 'admin-alert',
          data: {
            alertTitle: 'Event Baru',
            alertMessage: `Organizer "${organizer.name}" membuat event baru: "${event.title}".`,
            details: `Event ID: ${event.id}\nTanggal: ${event.eventDate}\nStatus: ${event.status}`,
          },
        }),
      ),
    );
  }

  /** NOTIF-05: alert internal — masalah pembayaran (mis. gagal buat invoice Xendit) */
  static async notifyAdminPaymentIssue(order, errorMessage) {
    const adminEmails = await this._getAdminEmails();
    return Promise.all(
      adminEmails.map((email) =>
        MailService.send({
          to: email,
          subject: '[Admin] Masalah Pembayaran',
          template: 'admin-alert',
          data: {
            alertTitle: 'Masalah Pembayaran',
            alertMessage: `Gagal memproses pembayaran untuk order ${order.orderNumber}.`,
            details: errorMessage,
          },
        }),
      ),
    );
  }

  /** NOTIF-05: alert internal — system alert generik (error tak terduga) */
  static async notifyAdminSystemAlert(message, details) {
    const adminEmails = await this._getAdminEmails();
    return Promise.all(
      adminEmails.map((email) =>
        MailService.send({
          to: email,
          subject: '[Admin] System Alert',
          template: 'admin-alert',
          data: { alertTitle: 'System Alert', alertMessage: message, details },
        }),
      ),
    );
  }
}

module.exports = NotificationService;
