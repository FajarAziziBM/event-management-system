// tests/order.test.js
'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const OrderService = require('../src/services/order.service');

describe('ORD - Order & Ticket Purchase Flow', () => {
  let adminToken;
  let andiToken; // customer
  let citraToken; // customer lain (untuk uji ownership)

  beforeAll(async () => {
    const login = async (email, password) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      return res.body.data.token;
    };

    adminToken = await login('admin@eventhub.local', 'ChangeMe123!');
    andiToken = await login('andi@example.com', 'Password123!');
    citraToken = await login('citra@example.com', 'Password123!');
  });

  afterEach(async () => {
    // Bersihkan order & event bikinan test (prefix TEST_ORD_)
    const testEvents = await db.Event.findAll({
      where: { title: { [db.Sequelize.Op.like]: 'TEST_ORD_%' } },
    });
    for (const event of testEvents) {
      await db.Order.destroy({ where: { eventId: event.id } });
      await event.destroy();
    }
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  // Helper: buat & langsung publish event milik Budi dengan kuota tertentu
  async function createPublishedTestEvent({
    availableTicket = 50,
    ticketPrice = 100000,
    title,
  } = {}) {
    const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
    const event = await db.Event.create({
      creatorId: 2, // budi
      categoryId: category.id,
      title: title || `TEST_ORD_Event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 hari lagi
      eventEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      maxAttendees: availableTicket,
      ticketPrice,
      availableTicket,
      status: 'published',
    });
    return event;
  }

  describe('ORD-01: POST /api/v1/orders', () => {
    it('customer berhasil membuat order untuk event published', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 10 });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('pending');

      // Kuota event harus berkurang
      await event.reload();
      expect(event.availableTicket).toBe(8);
    });

    it('tanpa token ditolak (401)', async () => {
      const event = await createPublishedTestEvent();
      const res = await request(app)
        .post('/api/v1/orders')
        .send({ eventId: event.id, quantity: 1 });
      expect(res.status).toBe(401);
    });

    it('reject order untuk event berstatus draft (422)', async () => {
      const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
      const draftEvent = await db.Event.create({
        creatorId: 2,
        categoryId: category.id,
        title: `TEST_ORD_Draft_${Date.now()}`,
        eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        eventEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3600000),
        maxAttendees: 10,
        ticketPrice: 50000,
        availableTicket: 10,
        status: 'draft',
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: draftEvent.id, quantity: 1 });

      expect(res.status).toBe(422);
    });

    it('reject kuota tidak mencukupi (422)', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 2 });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 5 });

      expect(res.status).toBe(422);

      await event.reload();
      expect(event.availableTicket).toBe(2); // tidak berkurang sama sekali
    });

    it('reject quantity melebihi batas maksimal per order (422)', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 100 });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 11 });

      expect(res.status).toBe(422);
    });

    it('reject eventId yang tidak ada (404)', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: 999999, quantity: 1 });

      expect(res.status).toBe(404);
    });
  });

  describe('ORD-02: Format order_number', () => {
    it('order_number mengikuti format ORD-YYYYMMDD-XXXXXX', async () => {
      const event = await createPublishedTestEvent();

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      expect(res.body.data.orderNumber).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
    });
  });

  describe('ORD-03: Kalkulasi subtotal, service_fee, total_amount', () => {
    it('kalkulasi sesuai formula (subtotal = harga*qty, total = subtotal+fee)', async () => {
      const event = await createPublishedTestEvent({ ticketPrice: 100000, availableTicket: 10 });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 3 });

      const expectedSubtotal = 300000; // 100000 * 3
      expect(parseFloat(res.body.data.subtotal)).toBe(expectedSubtotal);
      expect(parseFloat(res.body.data.totalAmount)).toBe(
        expectedSubtotal + parseFloat(res.body.data.serviceFee),
      );
      expect(parseFloat(res.body.data.serviceFee)).toBeGreaterThan(0);
    });
  });

  describe('ORD-04: Race condition — row locking mencegah overselling', () => {
    it('dua request BERSAMAAN pada tiket tersisa TERAKHIR — hanya satu yang berhasil', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 1 });

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${andiToken}`)
          .send({ eventId: event.id, quantity: 1 }),
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${citraToken}`)
          .send({ eventId: event.id, quantity: 1 }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 422]); // satu sukses, satu gagal karena kuota habis

      await event.reload();
      expect(event.availableTicket).toBe(0); // TIDAK boleh minus (bukti tidak oversold)
    });
  });

  describe('ORD-05: GET /api/v1/orders (riwayat milik sendiri)', () => {
    it('hanya menampilkan order milik user yang login', async () => {
      const event = await createPublishedTestEvent();
      await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      res.body.data.orders.forEach((order) => {
        expect(order.userId).toBe(4); // andi
      });
    });

    it('order milik user lain TIDAK ikut muncul', async () => {
      const event = await createPublishedTestEvent();
      await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${citraToken}`)
        .send({ eventId: event.id, quantity: 1 });

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`);

      const citraOrderExists = res.body.data.orders.some(
        (o) => o.eventId === event.id && o.userId !== 4,
      );
      expect(citraOrderExists).toBe(false);
    });
  });

  describe('ORD-06: GET /api/v1/orders/:id', () => {
    it('pemilik bisa lihat detail order miliknya', async () => {
      const event = await createPublishedTestEvent();
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.event).toBeDefined();
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const event = await createPublishedTestEvent();
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${citraToken}`);

      expect(res.status).toBe(403);
    });

    it('admin boleh lihat order siapapun', async () => {
      const event = await createPublishedTestEvent();
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('404 untuk order tidak ada', async () => {
      const res = await request(app)
        .get('/api/v1/orders/999999')
        .set('Authorization', `Bearer ${andiToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('ORD-07: PATCH /api/v1/orders/:id/cancel', () => {
    it('pemilik berhasil membatalkan order pending, kuota dikembalikan', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 10 });
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 3 });

      await event.reload();
      expect(event.availableTicket).toBe(7);

      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.paymentStatus).toBe('cancelled');

      await event.reload();
      expect(event.availableTicket).toBe(10); // kuota kembali penuh
    });

    it('GUARD: order yang sudah paid tidak bisa dibatalkan (409)', async () => {
      // Order seed id 1 (SEED01) berstatus paid, milik Andi
      const res = await request(app)
        .patch('/api/v1/orders/1/cancel')
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(409);
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const event = await createPublishedTestEvent();
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 1 });

      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${citraToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('ORD-08: Auto-expire order pending (logika job, dipanggil langsung)', () => {
    it('order pending yang lewat expired_at di-set expired & kuota dikembalikan', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 10 });
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 4 });

      await event.reload();
      expect(event.availableTicket).toBe(6);

      // Paksa expired_at ke masa lalu supaya tertangkap job
      const order = await db.Order.findByPk(created.body.data.id);
      await order.update({ expiredAt: new Date(Date.now() - 60 * 1000) });

      const result = await OrderService.expirePendingOrders();
      expect(result.expiredCount).toBeGreaterThanOrEqual(1);

      await order.reload();
      expect(order.paymentStatus).toBe('expired');

      await event.reload();
      expect(event.availableTicket).toBe(10); // kuota dikembalikan
    });

    it('order pending yang BELUM lewat expired_at tidak ikut ter-expire', async () => {
      const event = await createPublishedTestEvent({ availableTicket: 10 });
      const created = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ eventId: event.id, quantity: 2 });

      await OrderService.expirePendingOrders();

      const order = await db.Order.findByPk(created.body.data.id);
      expect(order.paymentStatus).toBe('pending'); // belum expired_at, tidak disentuh
    });
  });
});
