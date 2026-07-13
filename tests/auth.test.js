// tests/auth.test.js
'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

describe('AUTH - Endpoints', () => {
  beforeEach(async () => {
    // Hapus test user sebelum setiap test
    await db.User.destroy({ where: { email: 'testuser@example.com' } });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('mendaftar user baru dengan berhasil', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'TestPassword123',
        passwordConfirm: 'TestPassword123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('testuser@example.com');
      expect(res.body.data.password).toBeUndefined(); // jangan return password
    });

    it('reject registrasi jika email sudah ada', async () => {
      // Daftar user pertama
      await request(app).post('/api/v1/auth/register').send({
        name: 'Test User 1',
        email: 'testuser@example.com',
        password: 'TestPassword123',
        passwordConfirm: 'TestPassword123',
      });

      // Coba daftar lagi dengan email sama
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test User 2',
        email: 'testuser@example.com',
        password: 'TestPassword123',
        passwordConfirm: 'TestPassword123',
      });

      expect(res.status).toBe(422); // ValidationError
      expect(res.body.success).toBe(false);
    });

    it('reject password yang terlalu pendek', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'short',
        passwordConfirm: 'short',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Buat user untuk login test
      await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'TestPassword123',
        passwordConfirm: 'TestPassword123',
      });
    });

    it('login berhasil dengan credential yang benar', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'testuser@example.com',
        password: 'TestPassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('testuser@example.com');
      expect(res.body.data.token).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined(); // cookie harus diset
    });

    it('reject login dengan password salah', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'testuser@example.com',
        password: 'WrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('reject login dengan email tidak terdaftar', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'notfound@example.com',
        password: 'TestPassword123',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let token;

    beforeEach(async () => {
      // Daftar & login untuk dapat token
      await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'TestPassword123',
        passwordConfirm: 'TestPassword123',
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'testuser@example.com',
        password: 'TestPassword123',
      });

      token = loginRes.body.data.token;
    });

    it('ambil profil user dengan valid token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('testuser@example.com');
      expect(res.body.data.password).toBeUndefined();
    });

    it('reject request tanpa token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('reject request dengan token invalid', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('logout berhasil', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined(); // cookie harus dihapus
    });
  });

  describe('Web routes - halaman login/register', () => {
    it('GET /auth/login render halaman login', async () => {
      const res = await request(app).get('/auth/login');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Masuk');
    });

    it('GET /auth/register render halaman register', async () => {
      const res = await request(app).get('/auth/register');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Daftar Akun');
    });

    it('GET /auth/forgot-password render halaman forgot-password', async () => {
      const res = await request(app).get('/auth/forgot-password');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Lupa Password');
    });
  });
});
