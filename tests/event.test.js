// tests/event.test.js
'use strict';

const path = require('node:path');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

const FIXTURES = path.join(__dirname, 'fixtures');

describe('EVT - Event Management', () => {
  let adminToken;
  let budiToken; // organizer, pemilik event seed id 1, 2, 5
  let sintaToken; // organizer, pemilik event seed id 3, 4, 6
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

  afterEach(async () => {
    // Bersihkan seluruh event bikinan test (prefix TEST_EVT_) LEWAT EventService
    // (bukan destroy() mentah) supaya file banner/lampiran fisik di disk ikut terhapus.
    const EventService = require('../src/services/event.service');
    const testEvents = await db.Event.findAll({
      where: { title: { [db.Sequelize.Op.like]: 'TEST_EVT_%' } },
    });
    for (const event of testEvents) {
      await db.Order.destroy({ where: { eventId: event.id } }).catch(() => {});
      await EventService.deleteEvent(event.id, event.creatorId, 'admin').catch(async () => {
        // fallback kalau service gagal (mis. masih ada FK lain) — tetap bersihkan record
        await db.EventAttachment.destroy({ where: { eventId: event.id } }).catch(() => {});
        await event.destroy().catch(() => {});
      });
    }
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  // Helper: buat event draft milik Budi untuk dipakai berbagai test
  async function createTestEvent(token, overrides = {}) {
    const categories = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: categories.id,
        title: overrides.title || 'TEST_EVT_Contoh Event',
        description: 'Deskripsi event untuk testing',
        venue: 'Venue Test',
        eventDate: '2026-12-01T19:00:00+07:00',
        eventEndDate: '2026-12-01T22:00:00+07:00',
        maxAttendees: 100,
        ticketPrice: 50000,
        ...overrides,
      });
    return res;
  }

  describe('EVT-01: POST /api/v1/events', () => {
    it('organizer berhasil membuat event baru dengan status draft', async () => {
      const res = await createTestEvent(budiToken);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.slug).toBeDefined();
      expect(res.body.data.availableTicket).toBe(100);
    });

    it('admin juga boleh membuat event', async () => {
      const res = await createTestEvent(adminToken, { title: 'TEST_EVT_Oleh Admin' });
      expect(res.status).toBe(201);
    });

    it('customer TIDAK boleh membuat event (403)', async () => {
      const res = await createTestEvent(andiToken);
      expect(res.status).toBe(403);
    });

    it('tanpa token ditolak (401)', async () => {
      const categories = await db.Category.findOne({ where: { name: 'Konser & Musik' } });
      const res = await request(app).post('/api/v1/events').send({
        categoryId: categories.id,
        title: 'TEST_EVT_Tanpa Auth',
        eventDate: '2026-12-01T19:00:00+07:00',
        eventEndDate: '2026-12-01T22:00:00+07:00',
        maxAttendees: 10,
        ticketPrice: 0,
      });
      expect(res.status).toBe(401);
    });

    it('reject categoryId yang tidak ada (422)', async () => {
      const res = await createTestEvent(budiToken, { categoryId: 99999 });
      expect(res.status).toBe(422);
    });

    it('reject eventEndDate sebelum eventDate (422)', async () => {
      const res = await createTestEvent(budiToken, {
        eventDate: '2026-12-01T19:00:00+07:00',
        eventEndDate: '2026-12-01T10:00:00+07:00',
      });
      expect(res.status).toBe(422);
    });

    it('reject judul kosong (422)', async () => {
      const res = await createTestEvent(budiToken, { title: '' });
      expect(res.status).toBe(422);
    });
  });

  describe('EVT-02: PUT /api/v1/events/:id', () => {
    it('pemilik berhasil mengedit event miliknya', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .put(`/api/v1/events/${created.body.data.id}`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ title: 'TEST_EVT_Sudah Diedit', venue: 'Venue Baru' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('TEST_EVT_Sudah Diedit');
      expect(res.body.data.venue).toBe('Venue Baru');
    });

    it('BUKAN pemilik (organizer lain) ditolak (403)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .put(`/api/v1/events/${created.body.data.id}`)
        .set('Authorization', `Bearer ${sintaToken}`)
        .send({ title: 'Coba Ubah Punya Orang' });

      expect(res.status).toBe(403);
    });

    it('admin boleh mengedit event siapapun', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .put(`/api/v1/events/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'TEST_EVT_Diedit Admin' });

      expect(res.status).toBe(200);
    });

    it('menambah maxAttendees ikut menambah availableTicket', async () => {
      const created = await createTestEvent(budiToken, { maxAttendees: 100 });
      const res = await request(app)
        .put(`/api/v1/events/${created.body.data.id}`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ maxAttendees: 150 });

      expect(res.status).toBe(200);
      expect(res.body.data.availableTicket).toBe(150); // 100 + 50 selisih
    });

    it('404 jika event tidak ditemukan', async () => {
      const res = await request(app)
        .put('/api/v1/events/999999')
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ title: 'Tidak Ada' });

      expect(res.status).toBe(404);
    });
  });

  describe('EVT-03: DELETE /api/v1/events/:id', () => {
    it('pemilik berhasil hapus event draft tanpa order', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .delete(`/api/v1/events/${created.body.data.id}`)
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GUARD: menolak hapus event yang masih punya order (409 Conflict)', async () => {
      // Event seed id 1 (Konser Musik Indie Jakarta) punya order SEED01 & SEED05
      const res = await request(app)
        .delete('/api/v1/events/1')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(409);

      const stillExists = await db.Event.findByPk(1);
      expect(stillExists).not.toBeNull();
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .delete(`/api/v1/events/${created.body.data.id}`)
        .set('Authorization', `Bearer ${sintaToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('EVT-04 & EVT-05: Publish / Unpublish flow', () => {
    it('draft -> published berhasil', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/publish`)
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('published');
    });

    it('publish event yang sudah published ditolak (409)', async () => {
      const created = await createTestEvent(budiToken);
      await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/publish`)
        .set('Authorization', `Bearer ${budiToken}`);

      const res = await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/publish`)
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(409);
    });

    it('published -> draft (default targetStatus)', async () => {
      const created = await createTestEvent(budiToken);
      await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/publish`)
        .set('Authorization', `Bearer ${budiToken}`);

      const res = await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/unpublish`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('draft');
    });

    it('published -> closed (targetStatus eksplisit)', async () => {
      const created = await createTestEvent(budiToken);
      await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/publish`)
        .set('Authorization', `Bearer ${budiToken}`);

      const res = await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/unpublish`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({ targetStatus: 'closed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('closed');
    });

    it('unpublish event draft ditolak (409, bukan published)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .patch(`/api/v1/events/${created.body.data.id}/unpublish`)
        .set('Authorization', `Bearer ${budiToken}`)
        .send({});

      expect(res.status).toBe(409);
    });
  });

  describe('EVT-06: POST /api/v1/events/:id/banner', () => {
    it('pemilik berhasil upload banner (PNG)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/banner`)
        .set('Authorization', `Bearer ${budiToken}`)
        .attach('banner', path.join(FIXTURES, 'test-banner.png'));

      expect(res.status).toBe(200);
      expect(res.body.data.imagePath).toBeDefined();
      expect(res.body.data.imagePath).toContain('banners');
    });

    it('reject tipe file yang bukan gambar (422)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/banner`)
        .set('Authorization', `Bearer ${budiToken}`)
        .attach('banner', path.join(FIXTURES, 'test-invalid.txt'));

      expect(res.status).toBe(422);
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/banner`)
        .set('Authorization', `Bearer ${sintaToken}`)
        .attach('banner', path.join(FIXTURES, 'test-banner.png'));

      expect(res.status).toBe(403);
    });
  });

  describe('EVT-07 & EVT-08: Upload & hapus lampiran', () => {
    it('pemilik berhasil upload lampiran PDF', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/attachments`)
        .set('Authorization', `Bearer ${budiToken}`)
        .attach('attachment', path.join(FIXTURES, 'test-attachment.pdf'));

      expect(res.status).toBe(201);
      expect(res.body.data.fileName).toBe('test-attachment.pdf');
    });

    it('reject tipe file yang tidak didukung (422)', async () => {
      const created = await createTestEvent(budiToken);
      const res = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/attachments`)
        .set('Authorization', `Bearer ${budiToken}`)
        .attach('attachment', path.join(FIXTURES, 'test-invalid.txt'));

      expect(res.status).toBe(422);
    });

    it('pemilik berhasil menghapus lampiran (EVT-08)', async () => {
      const created = await createTestEvent(budiToken);
      const uploadRes = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/attachments`)
        .set('Authorization', `Bearer ${budiToken}`)
        .attach('attachment', path.join(FIXTURES, 'test-attachment.pdf'));

      const res = await request(app)
        .delete(`/api/v1/attachments/${uploadRes.body.data.id}`)
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
    });

    it('BUKAN pemilik ditolak hapus lampiran (403)', async () => {
      const created = await createTestEvent(budiToken);
      const uploadRes = await request(app)
        .post(`/api/v1/events/${created.body.data.id}/attachments`)
        .set('Authorization', `Bearer ${budiToken}`)
        .attach('attachment', path.join(FIXTURES, 'test-attachment.pdf'));

      const res = await request(app)
        .delete(`/api/v1/attachments/${uploadRes.body.data.id}`)
        .set('Authorization', `Bearer ${sintaToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('EVT-09 & EVT-11: GET /api/v1/events (list publik, filter, pagination)', () => {
    it('hanya menampilkan event berstatus published (tidak termasuk draft/closed)', async () => {
      const res = await request(app).get('/api/v1/events');

      expect(res.status).toBe(200);
      const titles = res.body.data.events.map((e) => e.title);
      expect(titles).not.toContain('Fun Run 5K Jakarta'); // status draft
      expect(titles).not.toContain('Meetup Developer Jakarta #12'); // status closed
      expect(titles).toContain('Konser Musik Indie Jakarta 2026'); // published
    });

    it('response menyertakan info pagination', async () => {
      const res = await request(app).get('/api/v1/events?page=1&limit=2');

      expect(res.body.data.pagination).toEqual(expect.objectContaining({ page: 1, limit: 2 }));
      expect(res.body.data.events.length).toBeLessThanOrEqual(2);
    });

    it('filter by category bekerja', async () => {
      const category = await db.Category.findOne({ where: { name: 'Kuliner' } });
      const res = await request(app).get(`/api/v1/events?category=${category.id}`);

      expect(res.status).toBe(200);
      res.body.data.events.forEach((e) => {
        expect(e.category.name).toBe('Kuliner');
      });
    });

    it('filter by search (judul) bekerja', async () => {
      const res = await request(app).get('/api/v1/events?search=Konser');

      expect(res.status).toBe(200);
      expect(res.body.data.events.length).toBeGreaterThanOrEqual(1);
      res.body.data.events.forEach((e) => {
        expect(e.title.toLowerCase()).toContain('konser');
      });
    });

    it('filter by rentang harga bekerja', async () => {
      const res = await request(app).get('/api/v1/events?minPrice=100000&maxPrice=200000');

      expect(res.status).toBe(200);
      res.body.data.events.forEach((e) => {
        expect(parseFloat(e.ticketPrice)).toBeGreaterThanOrEqual(100000);
        expect(parseFloat(e.ticketPrice)).toBeLessThanOrEqual(200000);
      });
    });
  });

  describe('EVT-10: GET /api/v1/events/:slug', () => {
    it('event published terlihat tanpa login', async () => {
      const res = await request(app).get('/api/v1/events/konser-musik-indie-jakarta-2026');

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Konser Musik Indie Jakarta 2026');
    });

    it('event draft TIDAK terlihat publik (404)', async () => {
      const res = await request(app).get('/api/v1/events/fun-run-5k-jakarta');
      expect(res.status).toBe(404);
    });

    it('event draft TETAP terlihat oleh pemiliknya sendiri', async () => {
      const res = await request(app)
        .get('/api/v1/events/fun-run-5k-jakarta')
        .set('Authorization', `Bearer ${sintaToken}`); // Sinta = pemilik Fun Run

      expect(res.status).toBe(200);
    });

    it('slug tidak ada -> 404', async () => {
      const res = await request(app).get('/api/v1/events/slug-tidak-pernah-ada');
      expect(res.status).toBe(404);
    });
  });

  describe('EVT-12: GET /api/v1/organizer/events/:id/statistics', () => {
    it('pemilik mendapat statistik akurat sesuai data seed', async () => {
      // Event id 1 (Konser Musik): order SEED01 (paid, qty2, total 305000) + SEED05 (cancelled, qty2)
      const res = await request(app)
        .get('/api/v1/organizer/events/1/statistics')
        .set('Authorization', `Bearer ${budiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalOrders).toBe(2);
      expect(res.body.data.ordersByStatus.paid).toBe(1);
      expect(res.body.data.ordersByStatus.cancelled).toBe(1);
      expect(res.body.data.totalRevenue).toBe(305000);
      expect(res.body.data.totalTicketsSold).toBe(2);
      expect(res.body.data.totalTicketsIssued).toBe(2);
      expect(res.body.data.checkedInCount).toBe(0);
    });

    it('BUKAN pemilik ditolak (403)', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/events/1/statistics')
        .set('Authorization', `Bearer ${sintaToken}`);

      expect(res.status).toBe(403);
    });

    it('customer ditolak (403) — role tidak diizinkan sama sekali', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/events/1/statistics')
        .set('Authorization', `Bearer ${andiToken}`);

      expect(res.status).toBe(403);
    });

    it('admin boleh melihat statistik event siapapun', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/events/1/statistics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});
