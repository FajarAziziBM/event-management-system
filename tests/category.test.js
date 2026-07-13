// tests/category.test.js
'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

describe('CAT - Category Management', () => {
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    // Login sebagai admin (seeded di DB-10)
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@eventhub.local', password: 'ChangeMe123!' });
    adminToken = adminLogin.body.data.token;

    // Login sebagai customer (seeded di DB seeder demo-organizers-customers)
    const customerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'andi@example.com', password: 'Password123!' });
    customerToken = customerLogin.body.data.token;
  });

  afterEach(async () => {
    // Bersihkan kategori yang dibuat selama test, jangan sentuh 8 kategori seed asli
    await db.Category.destroy({
      where: {
        name: [
          'Kategori Test Baru',
          'Kategori Test Update',
          'Kategori Sebelum Update',
          'Kategori Untuk Dihapus',
          'Duplikat Nama',
        ],
      },
    });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('CAT-01: GET /api/v1/categories (publik)', () => {
    it('mengembalikan daftar kategori tanpa perlu login', async () => {
      const res = await request(app).get('/api/v1/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(8); // minimal 8 seed default
    });

    it('setiap kategori punya field eventCount', async () => {
      const res = await request(app).get('/api/v1/categories');

      const konser = res.body.data.find((c) => c.name === 'Konser & Musik');
      expect(konser).toBeDefined();
      expect(konser).toHaveProperty('eventCount');
      expect(konser.eventCount).toBeGreaterThanOrEqual(1); // ada event seed yang pakai ini
    });
  });

  describe('CAT-02: POST /api/v1/categories (admin only)', () => {
    it('admin berhasil membuat kategori baru', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Kategori Test Baru', description: 'Deskripsi test', icon: 'star' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Kategori Test Baru');
    });

    it('customer TIDAK boleh membuat kategori (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Kategori Test Baru' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('tanpa token TIDAK boleh membuat kategori (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .send({ name: 'Kategori Test Baru' });

      expect(res.status).toBe(401);
    });

    it('CAT-05: reject nama kosong', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('CAT-05: reject nama duplikat (harus unik)', async () => {
      // Buat kategori pertama
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Duplikat Nama' });

      // Coba buat lagi dengan nama sama
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Duplikat Nama' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('CAT-03: PUT /api/v1/categories/:id (admin only)', () => {
    it('admin berhasil mengedit kategori', async () => {
      const created = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Kategori Sebelum Update' });

      const res = await request(app)
        .put(`/api/v1/categories/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Kategori Test Update', description: 'Diperbarui' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Kategori Test Update');
      expect(res.body.data.description).toBe('Diperbarui');
    });

    it('customer TIDAK boleh mengedit kategori (403)', async () => {
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Coba Ubah' });

      expect(res.status).toBe(403);
    });

    it('reject update ke nama yang sudah dipakai kategori lain', async () => {
      const res = await request(app)
        .put('/api/v1/categories/1') // Konser & Musik
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Workshop & Pelatihan' }); // nama kategori lain yang sudah ada

      expect(res.status).toBe(422);
    });

    it('404 jika kategori tidak ditemukan', async () => {
      const res = await request(app)
        .put('/api/v1/categories/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tidak Ada' });

      expect(res.status).toBe(404);
    });
  });

  describe('CAT-04: DELETE /api/v1/categories/:id (admin only, guard event)', () => {
    it('admin berhasil menghapus kategori yang TIDAK dipakai event manapun', async () => {
      const created = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Kategori Untuk Dihapus' });

      const res = await request(app)
        .delete(`/api/v1/categories/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GUARD: menolak hapus kategori yang masih dipakai event (409 Conflict)', async () => {
      // Kategori id 1 (Konser & Musik) dipakai oleh event seed "Konser Musik Indie Jakarta 2026"
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);

      // Pastikan kategori TIDAK benar-benar terhapus
      const stillExists = await db.Category.findByPk(1);
      expect(stillExists).not.toBeNull();
    });

    it('customer TIDAK boleh menghapus kategori (403)', async () => {
      const res = await request(app)
        .delete('/api/v1/categories/6')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('404 jika kategori tidak ditemukan', async () => {
      const res = await request(app)
        .delete('/api/v1/categories/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
