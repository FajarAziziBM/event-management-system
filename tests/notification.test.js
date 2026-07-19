// tests/notification.test.js
'use strict';

const path = require('node:path');
const ejs = require('ejs');
const request = require('supertest');

jest.mock('../src/services/xendit.service');

const app = require('../src/app');
const db = require('../src/models');
const transporter = require('../src/config/mailer');
const XenditService = require('../src/services/xendit.service');
const NotificationService = require('../src/services/notification.service');
const MailService = require('../src/services/mail.service');

const TEMPLATES_DIR = path.join(__dirname, '..', 'src', 'views', 'emails');
const CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || 'dummy_token';

describe('NOTIF - Notifications', () => {
  let adminToken;
  let budiToken;
  let andiToken;

  beforeAll(async () => {
    const login = async (email, password) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      return res.body.data.token;
    };

    adminToken = await login('admin@eventhub.local', 'ChangeMe123!');
    budiToken = await login('budi.organizer@eventhub.local', 'Password123!');
    andiToken = await login('andi@example.com', 'Password123!');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    XenditService.createInvoice.mockImplementation(async ({ externalId }) => ({
      id: `mock-inv-${externalId}`,
      externalId,
      invoiceUrl: `https://checkout-mock.xendit.co/web/mock-inv-${externalId}`,
      status: 'PENDING',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    }));
  });

  afterEach(async () => {
    await db.User.destroy({
      where: { email: { [db.Sequelize.Op.like]: 'test-notif-%@example.com' } },
    });
    const testEvents = await db.Event.findAll({
      where: { title: { [db.Sequelize.Op.like]: 'TEST_NOTIF_%' } },
    });
    for (const event of testEvents) {
      const orders = await db.Order.findAll({ where: { eventId: event.id } });
      for (const order of orders) {
        await db.Ticket.destroy({ where: { orderId: order.id } });
        await db.Payment.destroy({ where: { orderId: order.id } });
      }
      await db.Order.destroy({ where: { eventId: event.id } });
      await event.destroy();
    }
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  async function createPaidTicketFlow({ organizerId = 2, quantity = 1 } = {}) {
    const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
    const event = await db.Event.create({
      creatorId: organizerId,
      categoryId: category.id,
      title: `TEST_NOTIF_Event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      eventEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      maxAttendees: 50,
      ticketPrice: 100000,
      availableTicket: 50,
      status: 'published',
    });

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${andiToken}`)
      .send({ eventId: event.id, quantity });

    return { event, order: orderRes.body.data };
  }

  describe('NOTIF-01: Infrastruktur email', () => {
    it('seluruh templat email berhasil dirender dengan data realistis', async () => {
      const samples = {
        'registration-success': { name: 'Andi', appUrl: 'http://localhost:3000' },
        'password-reset': { name: 'Andi', resetUrl: 'http://localhost:3000/reset?token=x' },
        'payment-success': {
          name: 'Andi',
          eventTitle: 'Konser',
          orderNumber: 'ORD-1',
          quantity: 2,
          totalAmount: 200000,
          appUrl: 'http://localhost:3000',
          orderId: 1,
        },
        'payment-failed': {
          name: 'Andi',
          eventTitle: 'Konser',
          orderNumber: 'ORD-1',
          appUrl: 'x',
        },
        'payment-expired': {
          name: 'Andi',
          eventTitle: 'Konser',
          orderNumber: 'ORD-1',
          appUrl: 'x',
        },
        'event-updated': {
          name: 'Andi',
          eventTitle: 'Konser',
          eventSlug: 'konser',
          changes: ['Tanggal berubah'],
          appUrl: 'x',
        },
        'event-cancelled': { name: 'Andi', eventTitle: 'Konser' },
        'admin-alert': { alertTitle: 'Test', alertMessage: 'Pesan test', details: 'detail' },
      };

      for (const [template, data] of Object.entries(samples)) {
        const html = await ejs.renderFile(path.join(TEMPLATES_DIR, `${template}.ejs`), data);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html.length).toBeGreaterThan(100);
      }
    });

    it('MailService.send benar-benar memanggil transporter.sendMail dengan html hasil render', async () => {
      const spy = jest.spyOn(transporter, 'sendMail');

      await MailService.send({
        to: 'test-notif-mailservice@example.com',
        subject: 'Subjek Test',
        template: 'registration-success',
        data: { name: 'Test User', appUrl: 'http://localhost:3000' },
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test-notif-mailservice@example.com',
          subject: 'Subjek Test',
          html: expect.stringContaining('Test User'),
        }),
      );
      spy.mockRestore();
    });

    it('MailService.send TIDAK throw meski template tidak ada (fail gracefully)', async () => {
      const result = await MailService.send({
        to: 'test-notif-x@example.com',
        subject: 'X',
        template: 'template-tidak-ada-ini',
        data: {},
      });
      expect(result).toBeNull(); // tidak throw, cukup return null
    });
  });

  describe('NOTIF-02: Registrasi berhasil', () => {
    it('email registrasi terkirim dengan data benar setelah register', async () => {
      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Notif User',
        email: 'test-notif-register@example.com',
        password: 'TestPass123',
        passwordConfirm: 'TestPass123',
      });

      expect(res.status).toBe(201);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test-notif-register@example.com',
          subject: expect.stringContaining('Selamat Datang'),
          html: expect.stringContaining('Test Notif User'),
        }),
      );
      spy.mockRestore();
    });
  });

  describe('Pelengkap AUTH-04: Reset password', () => {
    it('email reset password terkirim berisi link dengan token', async () => {
      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'andi@example.com' });

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'andi@example.com',
          subject: expect.stringContaining('Reset Password'),
          html: expect.stringContaining('/auth/reset-password?token='),
        }),
      );
      spy.mockRestore();
    });
  });

  describe('NOTIF-03: Notifikasi pembayaran', () => {
    it('payment-success terkirim saat webhook PAID', async () => {
      const { event, order } = await createPaidTicketFlow({ quantity: 2 });
      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({
          external_id: order.orderNumber,
          status: 'PAID',
          paid_at: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'andi@example.com',
          subject: expect.stringContaining('Pembayaran Berhasil'),
          html: expect.stringContaining(event.title),
        }),
      );
      spy.mockRestore();
    });

    it('payment-expired terkirim saat webhook EXPIRED', async () => {
      const { order } = await createPaidTicketFlow();
      const spy = jest.spyOn(transporter, 'sendMail');

      await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({ external_id: order.orderNumber, status: 'EXPIRED' });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'andi@example.com',
          subject: expect.stringContaining('Kedaluwarsa'),
        }),
      );
      spy.mockRestore();
    });

    it('payment-failed terkirim saat webhook FAILED', async () => {
      const { order } = await createPaidTicketFlow();
      const spy = jest.spyOn(transporter, 'sendMail');

      await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({ external_id: order.orderNumber, status: 'FAILED' });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'andi@example.com',
          subject: expect.stringContaining('Pembayaran Gagal'),
        }),
      );

      const payment = await db.Payment.findOne({ where: { externalId: order.orderNumber } });
      expect(payment.status).toBe('failed');
      spy.mockRestore();
    });

    it('idempotent: webhook PAID dikirim 2x tetap hanya kirim email sukses SEKALI', async () => {
      const { order } = await createPaidTicketFlow();
      const payload = {
        external_id: order.orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      };

      await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send(payload);

      const spy = jest.spyOn(transporter, 'sendMail');
      await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send(payload);

      expect(spy).not.toHaveBeenCalled(); // sudah diproses sebelumnya, tidak kirim lagi
      spy.mockRestore();
    });
  });

  describe('NOTIF-04: Notifikasi ke pemegang tiket', () => {
    it('event-updated terkirim ke pemegang tiket saat tanggal event berubah', async () => {
      const { event, order } = await createPaidTicketFlow();
      await request(app).post('/api/webhooks/xendit').set('x-callback-token', CALLBACK_TOKEN).send({
        external_id: order.orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      });

      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .put(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ venue: 'Venue Baru Yang Berubah' });

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'andi@example.com',
          subject: expect.stringContaining('Pembaruan Event'),
          html: expect.stringContaining('Venue Baru Yang Berubah'),
        }),
      );
      spy.mockRestore();
    });

    it('update field TIDAK signifikan (deskripsi) TIDAK memicu notifikasi', async () => {
      const { event, order } = await createPaidTicketFlow();
      await request(app).post('/api/webhooks/xendit').set('x-callback-token', CALLBACK_TOKEN).send({
        external_id: order.orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      });

      const spy = jest.spyOn(transporter, 'sendMail');

      await request(app)
        .put(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ description: 'Deskripsi baru saja, bukan perubahan signifikan' });

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('event-cancelled terkirim ke pemegang tiket saat event dibatalkan', async () => {
      const { event, order } = await createPaidTicketFlow();
      await request(app).post('/api/webhooks/xendit').set('x-callback-token', CALLBACK_TOKEN).send({
        external_id: order.orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      });

      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .patch(`/api/v1/events/${event.id}/unpublish`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ targetStatus: 'cancelled' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'andi@example.com',
          subject: expect.stringContaining('Event Dibatalkan'),
        }),
      );
      spy.mockRestore();
    });
  });

  describe('NOTIF-05: Alert internal admin', () => {
    it('admin dinotifikasi saat event baru dibuat', async () => {
      const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({
          categoryId: category.id,
          title: 'TEST_NOTIF_Event Baru Admin Alert',
          eventDate: '2027-01-01T10:00:00+07:00',
          eventEndDate: '2027-01-01T15:00:00+07:00',
          maxAttendees: 10,
          ticketPrice: 0,
        });

      expect(res.status).toBe(201);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@eventhub.local',
          subject: expect.stringContaining('Event Baru'),
          html: expect.stringContaining('TEST_NOTIF_Event Baru Admin Alert'),
        }),
      );
      spy.mockRestore();
    });

    it('admin dinotifikasi saat organizer baru dibuat via admin API', async () => {
      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Notif Organizer',
          email: 'test-notif-organizer@example.com',
          password: 'TestPass123',
          role: 'organizer',
        });

      expect(res.status).toBe(201);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@eventhub.local',
          subject: expect.stringContaining('Organizer Baru'),
        }),
      );
      spy.mockRestore();
    });

    it('admin dinotifikasi saat invoice Xendit gagal dibuat (payment issue)', async () => {
      XenditService.createInvoice.mockRejectedValue(new Error('Xendit API down (simulasi)'));

      const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
      const event = await db.Event.create({
        creatorId: 2,
        categoryId: category.id,
        title: `TEST_NOTIF_PaymentIssue_${Date.now()}`,
        eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        eventEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3600000),
        maxAttendees: 10,
        ticketPrice: 50000,
        availableTicket: 10,
        status: 'published',
      });

      const spy = jest.spyOn(transporter, 'sendMail');

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      expect(res.status).toBe(201); // order tetap sukses dibuat
      expect(res.body.data.paymentUrl).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@eventhub.local',
          subject: expect.stringContaining('Masalah Pembayaran'),
        }),
      );
      spy.mockRestore();
    });

    it('notifyAdminSystemAlert terkirim ke SEMUA admin aktif (bukan cuma satu)', async () => {
      const secondAdmin = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Notif Admin Kedua',
          email: 'test-notif-admin2@example.com',
          password: 'TestPass123',
          role: 'admin',
        });
      expect(secondAdmin.status).toBe(201);

      const spy = jest.spyOn(transporter, 'sendMail');
      await NotificationService.notifyAdminSystemAlert('Test alert', 'detail error');

      const recipients = spy.mock.calls.map((call) => call[0].to);
      expect(recipients).toEqual(
        expect.arrayContaining(['admin@eventhub.local', 'test-notif-admin2@example.com']),
      );
      spy.mockRestore();

      await db.User.destroy({ where: { id: secondAdmin.body.data.id } });
    });
  });
});
