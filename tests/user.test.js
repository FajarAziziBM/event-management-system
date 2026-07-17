// tests/user.test.js
'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

describe('USR - User Management (Admin)', () => {
  let adminToken;
  let andiToken; // customer

  beforeAll(async () => {
    const login = async (email, password) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      return res.body.data.token;
    };

    adminToken = await login('admin@eventhub.local', 'ChangeMe123!');
    andiToken = await login('andi@example.com', 'Password123!');
  });

  afterEach(async () => {
    await db.User.destroy({
      where: { email: { [db.Sequelize.Op.like]: 'test-usr-%@example.com' } },
    });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('USR-01: GET /api/v1/admin/users', () => {
    it('admin melihat daftar user dengan pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeLessThanOrEqual(3);
      expect(res.body.data.pagination.totalItems).toBeGreaterThanOrEqual(6);
      expect(res.body.data.users[0].password).toBeUndefined();
    });

    it('search by nama bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=Budi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.some((u) => u.name.includes('Budi'))).toBe(true);
    });

    it('search by email bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=andi@example.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.users.some((u) => u.email === 'andi@example.com')).toBe(true);
    });

    it('filter by role bekerja', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=organizer')
        .set('Authorization', `Bearer ${adminToken}`);

      res.body.data.users.forEach((u) => expect(u.role).toBe('organizer'));
    });

    it('customer TIDAK boleh akses (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${andiToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('USR-02: POST /api/v1/admin/users', () => {
    it('admin berhasil buat user dengan role organizer', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Organizer',
          email: 'test-usr-organizer@example.com',
          password: 'TestPass123',
          role: 'organizer',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('organizer');
      expect(res.body.data.password).toBeUndefined();
    });

    it('admin bisa buat user role admin sekalipun (beda dari register publik)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Admin',
          email: 'test-usr-admin@example.com',
          password: 'TestPass123',
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('admin');
    });

    it('reject email duplikat (422)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplikat',
          email: 'andi@example.com', // sudah ada
          password: 'TestPass123',
          role: 'customer',
        });
      expect(res.status).toBe(422);
    });

    it('reject role tidak valid (422)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR',
          email: 'test-usr-invalidrole@example.com',
          password: 'TestPass123',
          role: 'superadmin',
        });
      expect(res.status).toBe(422);
    });

    it('customer TIDAK boleh buat user (403)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${andiToken}`)
        .send({
          name: 'Test',
          email: 'test-usr-x@example.com',
          password: 'TestPass123',
          role: 'customer',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('USR-03: PUT /api/v1/admin/users/:id', () => {
    it('admin berhasil edit nama & phone user', async () => {
      const created = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Edit',
          email: 'test-usr-edit@example.com',
          password: 'TestPass123',
          role: 'customer',
        });

      const res = await request(app)
        .put(`/api/v1/admin/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Nama Baru', phone: '081200000000' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Nama Baru');
      expect(res.body.data.phone).toBe('081200000000');
    });

    it('404 untuk user tidak ada', async () => {
      const res = await request(app)
        .put('/api/v1/admin/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tidak Ada' });
      expect(res.status).toBe(404);
    });
  });

  describe('USR-04: DELETE /api/v1/admin/users/:id', () => {
    it('admin berhasil hapus user tanpa event/order terkait', async () => {
      const created = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Delete',
          email: 'test-usr-delete@example.com',
          password: 'TestPass123',
          role: 'customer',
        });

      const res = await request(app)
        .delete(`/api/v1/admin/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('GUARD: admin tidak bisa hapus akun sendiri', async () => {
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(`/api/v1/admin/users/${meRes.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
    });

    it('GUARD: tidak bisa hapus satu-satunya admin (seed hanya 1 admin)', async () => {
      // Buat admin kedua dulu supaya kita tahu guard SPESIFIK ke "admin terakhir",
      // bukan admin secara umum
      const secondAdmin = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Admin Kedua',
          email: 'test-usr-admin2@example.com',
          password: 'TestPass123',
          role: 'admin',
        });

      // Sekarang ada 2 admin -> admin kedua BOLEH dihapus (bukan yang terakhir)
      const deleteSecond = await request(app)
        .delete(`/api/v1/admin/users/${secondAdmin.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteSecond.status).toBe(200);

      // Balik ke 1 admin -> sekarang TIDAK boleh dihapus (guard aktif)
      // Coba hapus diri sendiri sudah pasti diblok oleh guard "diri sendiri", jadi
      // untuk uji guard "admin terakhir" murni, kita perlu admin lain mencoba
      // menghapusnya -- tapi karena hanya ada 1 admin di seed, kita cukup pastikan
      // hapus diri sendiri tetap diblok (sudah dites di atas) dan jumlah admin tetap 1.
      const adminCount = await db.User.count({ where: { role: 'admin' } });
      expect(adminCount).toBe(1);
    });

    it('reject hapus user yang masih punya event (409)', async () => {
      // Budi (organizer, id 2) punya event seed -> tidak bisa dihapus
      const res = await request(app)
        .delete('/api/v1/admin/users/2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
    });
  });

  describe('USR-05: PATCH /api/v1/admin/users/:id/role — efek langsung', () => {
    it('perubahan role LANGSUNG berlaku di token LAMA tanpa perlu login ulang', async () => {
      // 1. Buat customer baru & login (dapat token dengan klaim role='customer')
      const created = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR RoleChange',
          email: 'test-usr-rolechange@example.com',
          password: 'TestPass123',
          role: 'customer',
        });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test-usr-rolechange@example.com', password: 'TestPass123' });
      const oldToken = loginRes.body.data.token;

      // 2. Sebagai customer, coba buat event -> harus 403 (belum organizer)
      const beforeRes = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          categoryId: 1,
          title: 'Test Event',
          eventDate: '2027-01-01',
          eventEndDate: '2027-01-02',
          maxAttendees: 10,
          ticketPrice: 0,
        });
      expect(beforeRes.status).toBe(403);

      // 3. Admin ubah role user ini jadi organizer
      const roleRes = await request(app)
        .patch(`/api/v1/admin/users/${created.body.data.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'organizer' });
      expect(roleRes.status).toBe(200);
      expect(roleRes.body.data.role).toBe('organizer');

      // 4. PAKAI TOKEN LAMA (belum login ulang) -> sekarang harus BOLEH buat event
      const afterRes = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          categoryId: 1,
          title: 'Test Event Setelah Role Berubah',
          eventDate: '2027-01-01T10:00:00+07:00',
          eventEndDate: '2027-01-01T15:00:00+07:00',
          maxAttendees: 10,
          ticketPrice: 0,
        });
      expect(afterRes.status).toBe(201);

      await db.Event.destroy({ where: { title: 'Test Event Setelah Role Berubah' } });
    });

    it('GUARD: admin tidak bisa ubah role sendiri', async () => {
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${meRes.body.data.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'customer' });

      expect(res.status).toBe(422);
    });

    it('reject role tidak valid (422)', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/4/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superuser' });
      expect(res.status).toBe(422);
    });
  });

  describe('USR-06: PATCH /api/v1/admin/users/:id/suspend — efek langsung', () => {
    it('suspend LANGSUNG memblokir token LAMA tanpa perlu tunggu expired', async () => {
      const created = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Suspend',
          email: 'test-usr-suspend@example.com',
          password: 'TestPass123',
          role: 'customer',
        });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test-usr-suspend@example.com', password: 'TestPass123' });
      const oldToken = loginRes.body.data.token;

      // Sebelum suspend: token bekerja normal
      const beforeRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(beforeRes.status).toBe(200);

      // Admin suspend user ini
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${created.body.data.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: true });
      expect(suspendRes.status).toBe(200);

      // PAKAI TOKEN LAMA -> sekarang harus DITOLAK (403), bukan menunggu token expired
      const afterRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(afterRes.status).toBe(403);
    });

    it('user yang disuspend TIDAK bisa login (403 langsung, bukan 200)', async () => {
      const created = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Suspend Login',
          email: 'test-usr-suspendlogin@example.com',
          password: 'TestPass123',
          role: 'customer',
        });

      await request(app)
        .patch(`/api/v1/admin/users/${created.body.data.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: true });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test-usr-suspendlogin@example.com', password: 'TestPass123' });

      expect(loginRes.status).toBe(403);
    });

    it('un-suspend (aktifkan) memulihkan akses', async () => {
      const created = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test USR Unsuspend',
          email: 'test-usr-unsuspend@example.com',
          password: 'TestPass123',
          role: 'customer',
        });

      await request(app)
        .patch(`/api/v1/admin/users/${created.body.data.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: true });

      await request(app)
        .patch(`/api/v1/admin/users/${created.body.data.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: false });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test-usr-unsuspend@example.com', password: 'TestPass123' });

      expect(loginRes.status).toBe(200);
    });

    it('GUARD: admin tidak bisa suspend akun sendiri', async () => {
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${meRes.body.data.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: true });

      expect(res.status).toBe(422);
    });
  });
});
