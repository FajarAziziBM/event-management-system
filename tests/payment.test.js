// tests/payment.test.js
'use strict';

jest.mock('../src/services/xendit.service');

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const XenditService = require('../src/services/xendit.service');
const PaymentService = require('../src/services/payment.service');

const CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || 'dummy_token';

describe('PAY - Xendit Payment Integration & Webhook', () => {
  let andiToken;
  let citraToken;

  beforeAll(async () => {
    const login = async (email, password) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      return res.body.data.token;
    };

    andiToken = await login('andi@example.com', 'Password123!');
    citraToken = await login('citra@example.com', 'Password123!');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: sukses, dipakai kebanyakan test kecuali di-override per-test
    XenditService.createInvoice.mockImplementation(async ({ externalId }) => ({
      id: `mock-inv-${externalId}`,
      externalId,
      invoiceUrl: `https://checkout-mock.xendit.co/web/mock-inv-${externalId}`,
      status: 'PENDING',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    }));
  });

  afterEach(async () => {
    const testEvents = await db.Event.findAll({
      where: { title: { [db.Sequelize.Op.like]: 'TEST_PAY_%' } },
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

  async function createPublishedTestEvent({ availableTicket = 20, ticketPrice = 100000 } = {}) {
    const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
    return db.Event.create({
      creatorId: 2,
      categoryId: category.id,
      title: `TEST_PAY_Event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      eventEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      maxAttendees: availableTicket,
      ticketPrice,
      availableTicket,
      status: 'published',
    });
  }

  async function createOrderViaApi(token, event, quantity = 1) {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, quantity });
    return res;
  }

  describe('PAY-02 & PAY-03: Invoice otomatis dibuat saat order dibuat', () => {
    it('POST /orders memanggil XenditService.createInvoice & menyimpan payment', async () => {
      const event = await createPublishedTestEvent();
      const res = await createOrderViaApi(andiToken, event, 2);

      expect(res.status).toBe(201);
      expect(XenditService.createInvoice).toHaveBeenCalledTimes(1);
      expect(XenditService.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ externalId: res.body.data.orderNumber }),
      );
      expect(res.body.data.paymentUrl).toContain('checkout-mock.xendit.co');

      const payment = await db.Payment.findOne({ where: { orderId: res.body.data.id } });
      expect(payment).not.toBeNull();
      expect(payment.invoiceId).toBe(`mock-inv-${res.body.data.orderNumber}`);
      expect(payment.status).toBe('pending');
    });

    it('kalau Xendit gagal, order TETAP dibuat (paymentUrl null, tidak 500)', async () => {
      XenditService.createInvoice.mockRejectedValue(new Error('Xendit API down'));

      const event = await createPublishedTestEvent();
      const res = await createOrderViaApi(andiToken, event, 1);

      expect(res.status).toBe(201);
      expect(res.body.data.paymentUrl).toBeNull();

      const payment = await db.Payment.findOne({ where: { orderId: res.body.data.id } });
      expect(payment).toBeNull(); // belum ada, akan lazy-retry lewat GET /payment
    });
  });

  describe('PAY-04: GET /api/v1/orders/:id/payment', () => {
    it('mengembalikan payment_url yang sudah ada', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}/payment`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.paymentUrl).toContain('checkout-mock.xendit.co');
    });

    it('lazy-retry: kalau payment belum ada (invoice gagal saat create), dibuat ulang di sini', async () => {
      XenditService.createInvoice.mockRejectedValueOnce(new Error('Xendit API down'));
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);
      expect(created.body.data.paymentUrl).toBeNull(); // gagal di awal

      // Sekarang Xendit "pulih" (mock default sukses lagi untuk panggilan berikutnya)
      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}/payment`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.paymentUrl).toBeDefined();
      expect(XenditService.createInvoice).toHaveBeenCalledTimes(2); // 1 gagal + 1 lazy-retry
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}/payment`)
        .set('Authorization', `Bearer ${citraToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PAY-05 & PAY-06: Webhook — verifikasi x-callback-token', () => {
    it('reject tanpa header x-callback-token (401)', async () => {
      const res = await request(app).post('/api/webhooks/xendit').send({
        external_id: 'ORD-TIDAK-ADA',
        status: 'PAID',
      });
      expect(res.status).toBe(401);
    });

    it('reject dengan token salah (401)', async () => {
      const res = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', 'token-yang-salah')
        .send({ external_id: 'ORD-TIDAK-ADA', status: 'PAID' });
      expect(res.status).toBe(401);
    });

    it('token benar tapi external_id tidak ditemukan -> tetap 200 (bukan error retry)', async () => {
      const res = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({ external_id: 'ORD-TIDAK-PERNAH-ADA', status: 'PAID' });

      expect(res.status).toBe(200);
      expect(res.body.data.handled).toBe(false);
    });
  });

  describe('PAY-07: Webhook status PAID -> generate tiket', () => {
    it('order jadi paid, tiket digenerate sejumlah quantity', async () => {
      const event = await createPublishedTestEvent({ ticketPrice: 150000 });
      const created = await createOrderViaApi(andiToken, event, 3);
      const orderNumber = created.body.data.orderNumber;

      const res = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({
          id: `mock-inv-${orderNumber}`,
          external_id: orderNumber,
          status: 'PAID',
          amount: 465000,
          paid_amount: 465000,
          payment_method: 'VIRTUAL_ACCOUNT',
          payment_channel: 'BCA',
          paid_at: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.ticketsGenerated).toBe(3);

      const order = await db.Order.findByPk(created.body.data.id);
      expect(order.paymentStatus).toBe('paid');
      expect(order.paymentMethod).toBe('VIRTUAL_ACCOUNT');

      const payment = await db.Payment.findOne({ where: { orderId: order.id } });
      expect(payment.status).toBe('paid');

      const tickets = await db.Ticket.findAll({ where: { orderId: order.id } });
      expect(tickets).toHaveLength(3);
      tickets.forEach((t) => {
        expect(t.ticketCode).toMatch(/^TIX-\d{6}-[A-Z0-9]{8}$/);
        expect(t.qrCode).toContain(t.ticketCode);
        expect(t.attendeeEmail).toBe('andi@example.com');
      });
    });

    it('status SETTLED juga diperlakukan sama seperti PAID', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);
      const orderNumber = created.body.data.orderNumber;

      const res = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({ external_id: orderNumber, status: 'SETTLED', paid_at: new Date().toISOString() });

      expect(res.status).toBe(200);
      const order = await db.Order.findByPk(created.body.data.id);
      expect(order.paymentStatus).toBe('paid');
    });
  });

  describe('PAY-08: Webhook status EXPIRED -> kembalikan kuota, TIDAK generate tiket', () => {
    it('order jadi expired, kuota event kembali, tiket tidak dibuat', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 10 });
      const created = await createOrderViaApi(andiToken, event, 4);

      await event.reload();
      expect(event.availableTicket).toBe(6);

      const res = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({ external_id: created.body.data.orderNumber, status: 'EXPIRED' });

      expect(res.status).toBe(200);

      const order = await db.Order.findByPk(created.body.data.id);
      expect(order.paymentStatus).toBe('expired');

      await event.reload();
      expect(event.availableTicket).toBe(10); // kuota kembali penuh

      const tickets = await db.Ticket.findAll({ where: { orderId: order.id } });
      expect(tickets).toHaveLength(0);
    });
  });

  describe('PAY-09: Idempotency — webhook yang sama dikirim berkali-kali', () => {
    it('webhook PAID dikirim 2x -> tiket HANYA digenerate sekali', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 2);
      const orderNumber = created.body.data.orderNumber;

      const webhookPayload = {
        id: `mock-inv-${orderNumber}`,
        external_id: orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      };

      const res1 = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send(webhookPayload);
      const res2 = await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send(webhookPayload);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.alreadyProcessed).toBeUndefined();
      expect(res2.body.data.alreadyProcessed).toBe(true);

      const tickets = await db.Ticket.findAll({ where: { orderId: created.body.data.id } });
      expect(tickets).toHaveLength(2); // BUKAN 4 — tidak digandakan
    });

    it('dua webhook PAID BERSAMAAN untuk order yang sama -> tetap hanya 1x proses', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);
      const orderNumber = created.body.data.orderNumber;

      const webhookPayload = {
        external_id: orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      };

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/webhooks/xendit')
          .set('x-callback-token', CALLBACK_TOKEN)
          .send(webhookPayload),
        request(app)
          .post('/api/webhooks/xendit')
          .set('x-callback-token', CALLBACK_TOKEN)
          .send(webhookPayload),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const tickets = await db.Ticket.findAll({ where: { orderId: created.body.data.id } });
      expect(tickets).toHaveLength(1); // row lock mencegah double-processing
    });
  });

  describe('PAY-10: GET /api/v1/orders/:id/payment-status (polling)', () => {
    it('mengembalikan status order & payment gabungan', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}/payment-status`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe('pending');
      expect(res.body.data.paymentStatus).toBe('pending');
    });

    it('setelah webhook PAID, polling menunjukkan status ter-update', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);
      const orderNumber = created.body.data.orderNumber;

      await request(app)
        .post('/api/webhooks/xendit')
        .set('x-callback-token', CALLBACK_TOKEN)
        .send({ external_id: orderNumber, status: 'PAID', paid_at: new Date().toISOString() });

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}/payment-status`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.body.data.orderStatus).toBe('paid');
      expect(res.body.data.paymentStatus).toBe('paid');
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}/payment-status`)
        .set('Authorization', `Bearer ${citraToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PAY-11: Audit logging ke Xendit', () => {
    it('XenditService.createInvoice benar-benar dipanggil dengan payload yang tepat (bukti request ter-log)', async () => {
      const event = await createPublishedTestEvent({ ticketPrice: 75000 });
      const created = await createOrderViaApi(andiToken, event, 2);

      expect(XenditService.createInvoice).toHaveBeenCalledWith({
        externalId: created.body.data.orderNumber,
        amount: 150000 + Math.round(150000 * 0.02), // subtotal + service fee 2%
        payerEmail: 'andi@example.com',
        description: expect.stringContaining(event.title),
      });
    });
  });

  describe('Sanity check: handleWebhook dipanggil langsung (bukan lewat HTTP)', () => {
    it('status selain PAID/SETTLED/EXPIRED diabaikan tanpa error', async () => {
      const event = await createPublishedTestEvent();
      const created = await createOrderViaApi(andiToken, event, 1);

      const result = await PaymentService.handleWebhook({
        external_id: created.body.data.orderNumber,
        status: 'PENDING',
      });

      expect(result.handled).toBe(true);
      expect(result.ignored).toBe(true);
    });
  });
});
