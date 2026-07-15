// tests/ticket.test.js
'use strict';

jest.mock('../src/services/xendit.service');

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const XenditService = require('../src/services/xendit.service');

describe('TIX - Ticket Management & Check-in', () => {
  let adminToken;
  let budiToken; // organizer, pemilik event 1 & 2 (seed)
  let sintaToken; // organizer, pemilik event 3,4,6 (seed) -- BUKAN pemilik event 1
  let andiToken; // customer, pemilik order SEED01 (ticket seed 1 & 2)
  let citraToken; // customer lain

  beforeAll(async () => {
    const login = async (email, password) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      return res.body.data.token;
    };

    adminToken = await login('admin@eventhub.local', 'ChangeMe123!');
    budiToken = await login('budi.organizer@eventhub.local', 'Password123!');
    sintaToken = await login('sinta.organizer@eventhub.local', 'Password123!');
    andiToken = await login('andi@example.com', 'Password123!');
    citraToken = await login('citra@example.com', 'Password123!');
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
    const testEvents = await db.Event.findAll({
      where: { title: { [db.Sequelize.Op.like]: 'TEST_TIX_%' } },
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

  async function createPaidTicket({
    organizerId = 2,
    quantity = 1,
    customerToken = andiToken,
  } = {}) {
    const category = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
    const event = await db.Event.create({
      creatorId: organizerId,
      categoryId: category.id,
      title: `TEST_TIX_Event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      eventEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      maxAttendees: 50,
      ticketPrice: 100000,
      availableTicket: 50,
      status: 'published',
    });

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ eventId: event.id, quantity });

    await request(app)
      .post('/api/webhooks/xendit')
      .set('x-callback-token', process.env.XENDIT_CALLBACK_TOKEN || 'dummy_token')
      .send({
        external_id: orderRes.body.data.orderNumber,
        status: 'PAID',
        paid_at: new Date().toISOString(),
      });

    const tickets = await db.Ticket.findAll({ where: { orderId: orderRes.body.data.id } });
    return { event, order: orderRes.body.data, tickets };
  }

  describe('TIX-02: QR code encoding', () => {
    it('qrCodeImage yang dikembalikan berupa data URL PNG valid', async () => {
      const { tickets } = await createPaidTicket();
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.qrCodeImage).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('TIX-03: GET /api/v1/tickets/:id', () => {
    it('pemilik tiket (customer) bisa lihat detail + QR', async () => {
      const { tickets } = await createPaidTicket({ customerToken: andiToken });
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}`)
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ticketCode).toBe(tickets[0].ticketCode);
    });

    it('organizer pemilik event terkait bisa lihat tiket', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2, customerToken: andiToken });
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}`)
        .set('Authorization', `Bearer ${budiToken}`); // budi = organizerId 2

      expect(res.status).toBe(200);
    });

    it('BUKAN pemilik & BUKAN organizer terkait ditolak (403)', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2, customerToken: andiToken });
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}`)
        .set('Authorization', `Bearer ${citraToken}`); // bukan pemilik, bukan organizer event ini

      expect(res.status).toBe(403);
    });

    it('admin boleh lihat tiket siapapun', async () => {
      const { tickets } = await createPaidTicket();
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('404 untuk tiket tidak ada', async () => {
      const res = await request(app)
        .get('/api/v1/tickets/999999')
        .set('Authorization', `Bearer ${andiToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('TIX-04: GET /api/v1/tickets/:id/download', () => {
    it('pemilik berhasil download PDF valid', async () => {
      const { tickets } = await createPaidTicket();
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}/download`)
        .set('Authorization', `Bearer ${andiToken}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain(tickets[0].ticketCode);
      expect(res.body.slice(0, 4).toString()).toBe('%PDF'); // magic bytes PDF asli
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const { tickets } = await createPaidTicket({ customerToken: andiToken });
      const res = await request(app)
        .get(`/api/v1/tickets/${tickets[0].id}/download`)
        .set('Authorization', `Bearer ${citraToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('TIX-05 & TIX-06: POST /api/v1/tickets/scan', () => {
    it('organizer berhasil scan tiket event miliknya (payload QR penuh)', async () => {
      const { tickets, event } = await createPaidTicket({ organizerId: 2 });
      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ payload: tickets[0].qrCode });

      expect(res.status).toBe(200);
      expect(res.body.data.ticketCode).toBe(tickets[0].ticketCode);
      expect(res.body.data.eventTitle).toBe(event.title);

      const updated = await db.Ticket.findByPk(tickets[0].id);
      expect(updated.isCheckedIn).toBe(true);
      expect(updated.checkedInAt).not.toBeNull();
    });

    it('fallback: scan pakai ticket_code polos (tanpa signature) tetap berhasil', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2 });
      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ payload: tickets[0].ticketCode }); // bukan qrCode penuh

      expect(res.status).toBe(200);
    });

    it('TIX-06: reject QR dengan signature dipalsukan (422)', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2 });
      const tamperedPayload = `${tickets[0].ticketCode}.signaturepalsu123`;

      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ payload: tamperedPayload });

      expect(res.status).toBe(422);

      const stillNotCheckedIn = await db.Ticket.findByPk(tickets[0].id);
      expect(stillNotCheckedIn.isCheckedIn).toBe(false);
    });

    it('TIX-06: organizer BUKAN pemilik event ditolak (403)', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2 }); // event milik budi

      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${sintaToken}`) // sinta bukan pemilik
        .send({ payload: tickets[0].qrCode });

      expect(res.status).toBe(403);

      const stillNotCheckedIn = await db.Ticket.findByPk(tickets[0].id);
      expect(stillNotCheckedIn.isCheckedIn).toBe(false);
    });

    it('customer TIDAK boleh scan sama sekali (403, diblok authorize)', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2 });
      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({ payload: tickets[0].qrCode });

      expect(res.status).toBe(403);
    });

    it('admin boleh scan tiket event siapapun', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 3 }); // event milik sinta
      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payload: tickets[0].qrCode });

      expect(res.status).toBe(200);
    });

    it('404 untuk ticket_code tidak ada', async () => {
      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ payload: 'TIX-999999-TIDAKADA' });

      expect(res.status).toBe(404);
    });
  });

  describe('TIX-07: Cegah duplicate check-in', () => {
    it('scan kedua kali pada tiket yang sama -> 409', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2 });

      const res1 = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ payload: tickets[0].qrCode });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ payload: tickets[0].qrCode });
      expect(res2.status).toBe(409);
    });

    it('tiket seed yang SUDAH check-in (TIX-SEED-0004) ditolak scan ulang', async () => {
      // Sinta = organizer event 6 (meetup), tiket ini sudah checked_in=true dari seeder
      const res = await request(app)
        .post('/api/v1/tickets/scan')
        .set('Authorization', `Bearer ${sintaToken}`)
        .send({ payload: 'TIX-SEED-0004' });

      expect(res.status).toBe(409);
    });

    it('RACE CONDITION: dua scan BERSAMAAN pada tiket yang sama -> hanya satu berhasil', async () => {
      const { tickets } = await createPaidTicket({ organizerId: 2 });

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/tickets/scan')
          .set('Authorization', `Bearer ${budiToken}`)
          .send({ payload: tickets[0].qrCode }),
        request(app)
          .post('/api/v1/tickets/scan')
          .set('Authorization', `Bearer ${budiToken}`)
          .send({ payload: tickets[0].qrCode }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]); // persis satu sukses, satu ditolak duplikat
    });
  });
});
