// tests/health.test.js

'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('GET /api/v1/health', () => {
  it('mengembalikan status 200 dan envelope sukses', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptime');
  });
});

describe('GET / (halaman beranda)', () => {
  it('merender layout + partial dengan benar', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Event Management System');
    expect(res.text).toContain('Jelajahi Event');
  });
});

describe('404 handler', () => {
  it('mengembalikan JSON error envelope untuk route API yang tidak ada', async () => {
    const res = await request(app).get('/api/v1/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('merender halaman error EJS untuk route web yang tidak ada', async () => {
    const res = await request(app).get('/halaman-tidak-ada');
    expect(res.status).toBe(404);
    expect(res.text).toContain('404');
  });
});
