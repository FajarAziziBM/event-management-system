// tests/dashboard.test.js
'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const cache = require('../src/utils/simpleCache');

describe('DASH - Dashboard & Reports', () => {
  let adminToken;
  let budiToken; // organizer, pemilik event 1 (konser), 2 (workshop), 5 (kuliner)
  let andiToken; // customer

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
    cache.clear(); // pastikan tiap test mulai dari cache kosong, tidak saling bocor
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('DASH-01: GET /api/v1/organizer/dashboard', () => {
    it('organizer melihat ringkasan akurat sesuai data seed (Budi: event 1,2,5)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/dashboard')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEvents).toBe(3); // konser, workshop, kuliner
      expect(res.body.data.eventsByStatus.published).toBe(3);
      // SEED01 (paid, qty2, 305000) + SEED02 (paid, qty1, 255000) -- SEED04(expired)/SEED05(cancelled) tidak dihitung
      expect(res.body.data.totalTicketsSold).toBe(3);
      expect(res.body.data.totalRevenue).toBe(560000);
      expect(res.body.data.totalVisitors).toBe(3); // TIX-SEED-0001,0002,0003
      expect(Array.isArray(res.body.data.upcomingEvents)).toBe(true);
    });

    it('customer TIDAK boleh akses (403)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/dashboard')
        .set('Authorization', `Bearer ${andiToken}`);
      expect(res.status).toBe(403);
    });

    it('tanpa token ditolak (401)', async () => {
      const res = await request(app).get('/api/v1/organizer/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('DASH-02: GET /api/v1/admin/dashboard', () => {
    it('admin melihat ringkasan platform akurat sesuai seed', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalUsers).toBe(6);
      expect(res.body.data.usersByRole).toEqual({ admin: 1, organizer: 2, customer: 3 });
      expect(res.body.data.totalEvents).toBe(6);
      expect(res.body.data.eventsByStatus).toEqual({
        draft: 1,
        published: 4,
        closed: 1,
        cancelled: 0,
      });
      expect(res.body.data.totalOrders).toBe(6);
      expect(res.body.data.ordersByStatus).toEqual({
        pending: 1,
        paid: 3,
        expired: 1,
        cancelled: 1,
        refunded: 0,
      });
      expect(res.body.data.totalRevenue).toBe(560000); // SEED01+SEED02 (SEED06 gratis, 0)
    });

    it('organizer (bukan admin) ditolak (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${budiToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DASH-03: GET /api/v1/organizer/reports/sales', () => {
    it('mengembalikan breakdown per event & per hari', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/reports/sales')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalRevenue).toBe(560000);
      expect(Array.isArray(res.body.data.byEvent)).toBe(true);
      expect(Array.isArray(res.body.data.byDay)).toBe(true);

      const konserRow = res.body.data.byEvent.find(
        (e) => e.title === 'Konser Musik Indie Jakarta 2026',
      );
      expect(konserRow).toBeDefined();
      expect(parseFloat(konserRow.revenue)).toBe(305000);
    });

    it('filter startDate/endDate diterima (format ISO8601)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/reports/sales?startDate=2020-01-01&endDate=2030-01-01')
        .set('Authorization', `Bearer ${budiToken}`);
      expect(res.status).toBe(200);
    });

    it('reject format tanggal tidak valid (422)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/reports/sales?startDate=bukan-tanggal')
        .set('Authorization', `Bearer ${budiToken}`);
      expect(res.status).toBe(422);
    });
  });

  describe('DASH-04: GET /api/v1/organizer/reports/event-performance', () => {
    it('list event dengan metrik occupancy & check-in rate benar', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/reports/event-performance')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3); // event milik budi

      const konser = res.body.data.find((e) => e.title === 'Konser Musik Indie Jakarta 2026');
      expect(konser.ticketsSold).toBe(2); // SEED01 qty2 (paid)
      expect(konser.ticketsIssued).toBe(2); // TIX-SEED-0001, 0002
      expect(konser.checkedIn).toBe(0); // belum check-in (event masa depan)
      expect(konser.checkInRate).toBe(0);
    });
  });

  describe('DASH-05: GET /api/v1/admin/reports/revenue', () => {
    it('admin melihat tren revenue & breakdown kategori', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRevenue).toBe(560000);
      expect(Array.isArray(res.body.data.byDay)).toBe(true);
      expect(Array.isArray(res.body.data.byCategory)).toBe(true);
    });

    it('organizer ditolak (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/revenue')
        .set('Authorization', `Bearer ${budiToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DASH-06: GET /api/v1/admin/reports/users', () => {
    it('admin melihat breakdown role & top organizer', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.usersByRole).toEqual({ admin: 1, organizer: 2, customer: 3 });
      expect(Array.isArray(res.body.data.topOrganizers)).toBe(true);

      const budiRow = res.body.data.topOrganizers.find(
        (o) => o.email === 'budi.organizer@eventhub.local',
      );
      expect(budiRow).toBeDefined();
      expect(parseFloat(budiRow.revenue)).toBe(560000);
    });
  });

  describe('DASH-07: GET /api/v1/admin/reports/payments', () => {
    it('admin melihat breakdown status & metode pembayaran', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.byStatus)).toBe(true);
      expect(Array.isArray(res.body.data.byMethod)).toBe(true);

      const paidStatusRow = res.body.data.byStatus.find((s) => s.status === 'paid');
      expect(paidStatusRow).toBeDefined();
      expect(parseInt(paidStatusRow.count, 10)).toBe(3);
    });
  });

  describe('DASH-08: Caching endpoint admin platform-wide', () => {
    it('panggilan kedua getAdminDashboard TIDAK query DB lagi (kena cache)', async () => {
      // Spy ke Order.findAll (bukan User.findAll) karena authenticate middleware
      // sendiri kini memanggil User.findByPk di SETIAP request (cek suspend/role
      // terbaru, lihat USR-05/06) -- dan findByPk Sequelize secara internal
      // memanggil findAll juga, jadi User.findAll bukan sinyal bersih lagi untuk
      // membuktikan cache-hit. Order.findAll tidak disentuh middleware apapun.
      const spy = jest.spyOn(db.Order, 'findAll');

      await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      const callsAfterFirst = spy.mock.calls.length;

      await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      const callsAfterSecond = spy.mock.calls.length;

      expect(callsAfterFirst).toBeGreaterThan(0); // pastikan spy memang menangkap panggilan asli
      expect(callsAfterSecond).toBe(callsAfterFirst); // tidak nambah -> cache hit
      spy.mockRestore();
    });

    it('cache admin dashboard TIDAK dipakai untuk endpoint organizer (data selalu fresh)', async () => {
      const spy = jest.spyOn(db.Event, 'findAll');

      await request(app)
        .get('/api/v1/organizer/dashboard')
        .set('Authorization', `Bearer ${budiToken}`);
      const callsAfterFirst = spy.mock.calls.length;

      await request(app)
        .get('/api/v1/organizer/dashboard')
        .set('Authorization', `Bearer ${budiToken}`);
      const callsAfterSecond = spy.mock.calls.length;

      expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst); // tetap query tiap kali
      spy.mockRestore();
    });
  });
});
