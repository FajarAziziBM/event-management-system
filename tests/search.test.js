// tests/search.test.js
'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

describe('SEARCH - Search & Filter', () => {
  let adminToken;
  let budiToken; // organizer, pemilik event 1 (konser), 2 (workshop), 5 (kuliner)
  let sintaToken; // organizer, pemilik event 3 (seminar), 4 (funrun-draft), 6 (meetup-closed)
  let andiToken; // customer

  beforeAll(async () => {
    const login = async (email, password) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      return res.body.data.token;
    };

    adminToken = await login('admin@eventhub.local', 'ChangeMe123!');
    budiToken = await login('budi.organizer@eventhub.local', 'Password123!');
    sintaToken = await login('sinta.organizer@eventhub.local', 'Password123!');
    andiToken = await login('andi@example.com', 'Password123!');
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('SEARCH-01: GET /api/v1/organizer/orders', () => {
    it('organizer hanya melihat order dari event MILIKNYA sendiri (Budi: 4 order)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.totalItems).toBe(4); // SEED01,02,04,05

      const orderNumbers = res.body.data.orders.map((o) => o.orderNumber);
      expect(orderNumbers).toEqual(
        expect.arrayContaining([
          'ORD-20260708-SEED01',
          'ORD-20260708-SEED02',
          'ORD-20260708-SEED04',
          'ORD-20260708-SEED05',
        ]),
      );
      expect(orderNumbers).not.toContain('ORD-20260708-SEED03'); // milik Sinta
    });

    it('organizer lain (Sinta) hanya melihat order event MILIKNYA (2 order)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders')
        .set('Authorization', `Bearer ${sintaToken}`);

      expect(res.body.data.pagination.totalItems).toBe(2); // SEED03, SEED06
    });

    it('search by nomor order bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders?search=SEED01')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.orders[0].orderNumber).toBe('ORD-20260708-SEED01');
    });

    it('search by nama customer bekerja (Andi punya 2 order di event Budi)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders?search=Andi')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.orders).toHaveLength(2); // SEED01, SEED04
      res.body.data.orders.forEach((o) => expect(o.user.name).toContain('Andi'));
    });

    it('search by email customer bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders?search=citra@example.com')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.orders.length).toBeGreaterThanOrEqual(1);
      res.body.data.orders.forEach((o) => expect(o.user.email).toBe('citra@example.com'));
    });

    it('filter by status=paid bekerja (hanya SEED01 & SEED02)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders?status=paid')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.orders).toHaveLength(2);
      res.body.data.orders.forEach((o) => expect(o.paymentStatus).toBe('paid'));
    });

    it('filter by eventId bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders?eventId=1')
        .set('Authorization', `Bearer ${budiToken}`);

      res.body.data.orders.forEach((o) => expect(o.eventId).toBe(1));
    });

    it('customer TIDAK boleh akses (403)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders')
        .set('Authorization', `Bearer ${andiToken}`);
      expect(res.status).toBe(403);
    });

    it('reject status tidak valid (422)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/orders?status=bukan_status_valid')
        .set('Authorization', `Bearer ${budiToken}`);
      expect(res.status).toBe(422);
    });
  });

  describe('SEARCH-01: GET /api/v1/organizer/tickets', () => {
    it('organizer hanya melihat tiket dari event MILIKNYA (Budi: 3 tiket)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.totalItems).toBe(3); // TIX-SEED-0001,0002,0003

      const codes = res.body.data.tickets.map((t) => t.ticketCode);
      expect(codes).not.toContain('TIX-SEED-0004'); // milik event Sinta
    });

    it('organizer lain (Sinta) hanya melihat tiket event miliknya (1 tiket)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets')
        .set('Authorization', `Bearer ${sintaToken}`);

      expect(res.body.data.pagination.totalItems).toBe(1); // TIX-SEED-0004
    });

    it('search by ticket_code bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets?search=TIX-SEED-0001')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.tickets).toHaveLength(1);
    });

    it('search by nama attendee bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets?search=Andi')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.tickets.length).toBeGreaterThanOrEqual(1);
      res.body.data.tickets.forEach((t) => expect(t.attendeeName).toContain('Andi'));
    });

    it('filter isCheckedIn=true bekerja (Sinta: 1 tiket sudah check-in)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets?isCheckedIn=true')
        .set('Authorization', `Bearer ${sintaToken}`);

      expect(res.body.data.tickets).toHaveLength(1);
      expect(res.body.data.tickets[0].ticketCode).toBe('TIX-SEED-0004');
    });

    it('filter isCheckedIn=false bekerja (Budi: semua 3 belum check-in)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets?isCheckedIn=false')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.body.data.tickets).toHaveLength(3);
    });

    it('customer TIDAK boleh akses (403)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/tickets')
        .set('Authorization', `Bearer ${andiToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('SEARCH-02: GET /api/v1/admin/search', () => {
    it('menemukan user yang cocok', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=Budi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.some((u) => u.name.includes('Budi'))).toBe(true);
    });

    it('menemukan event BERSTATUS DRAFT sekalipun (beda dari EVT-09 publik)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=Fun Run')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.events.some((e) => e.title.includes('Fun Run'))).toBe(true);
      const funRun = res.body.data.events.find((e) => e.title.includes('Fun Run'));
      expect(funRun.status).toBe('draft');
    });

    it('menemukan order yang cocok', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=SEED01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.orders.some((o) => o.orderNumber === 'ORD-20260708-SEED01')).toBe(true);
    });

    it('menemukan payment yang cocok (by invoice_id)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=seed-inv-000001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.payments.some((p) => p.invoiceId === 'seed-inv-000001')).toBe(true);
    });

    it('totalMatches menjumlahkan seluruh kategori', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=SEED')
        .set('Authorization', `Bearer ${adminToken}`);

      const expectedTotal =
        res.body.data.users.length +
        res.body.data.events.length +
        res.body.data.orders.length +
        res.body.data.payments.length;
      expect(res.body.data.totalMatches).toBe(expectedTotal);
    });

    it('organizer TIDAK boleh akses (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=test')
        .set('Authorization', `Bearer ${budiToken}`);
      expect(res.status).toBe(403);
    });

    it('reject query kurang dari 2 karakter (422)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search?q=a')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(422);
    });

    it('reject tanpa parameter q sama sekali (422)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/search')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(422);
    });
  });
});