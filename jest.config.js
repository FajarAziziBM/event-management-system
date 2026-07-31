// jest.config.js
'use strict';

/**
 * TEST-06: konfigurasi coverage & ambang batas minimum.
 *
 * `collectCoverageFrom` sengaja MENGECUALIKAN beberapa hal dari perhitungan
 * persentase, supaya angkanya benar-benar mencerminkan kualitas test business
 * logic — bukan tercampur/terlarut oleh kode yang secara alami tidak (atau
 * belum saatnya) diuji lewat unit/integration test Jest:
 *
 * - migrations/ & seeders/  : "teruji" lewat db:migrate/db:seed berhasil jalan,
 *                             bukan lewat assertion Jest.
 * - server.js               : murni bootstrap (app.listen + cron.start()) —
 *                             sudah tercakup transitif krn semua test lain
 *                             berhasil require('../src/app') yang di-boot server.js.
 * - jobs/                   : wrapper tipis node-cron. Logika sesungguhnya
 *                             (OrderService.expirePendingOrders) SUDAH diuji
 *                             tuntas baik lewat integration test (order.test.js)
 *                             maupun unit test (tests/unit/order.service.test.js).
 * - controllers/web, routes/web : rute EJS/server-rendered — di luar cakupan
 *                             Epic TEST ini (yang fokus ke endpoint API +
 *                             service layer + webhook, sesuai penamaan
 *                             ticket-nya). Sudah diverifikasi manual end-to-end
 *                             saat Epic FE & SEC (lihat RINGKASAN-*.md).
 * - beberapa file kosong/tidak pernah di-require (role.middleware.js,
 *   validate.middleware.js, requestLogger.js, config/multer.js) — scaffolding
 *   yang tidak pernah benar-benar dipakai, lihat SECURITY-CHECKLIST.md.
 *
 * Ambang batas di bawah dipasang ~7-8 poin di bawah baseline aktual saat
 * ditulis (87.89% stmt / 67% branch / 88.42% fn / 88.17% lines) — cukup ketat
 * utk menangkap regresi cakupan yang nyata, tapi tidak rapuh oleh perubahan kecil.
 */
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'],

  collectCoverage: false, // aktifkan lewat --coverage (npm run test:coverage), bukan tiap `npm test` biasa
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/migrations/**',
    '!src/seeders/**',
    '!src/server.js',
    '!src/jobs/**',
    '!src/controllers/web/**',
    '!src/routes/web/**',
    '!src/config/multer.js',
    '!src/middlewares/role.middleware.js',
    '!src/middlewares/validate.middleware.js',
    '!src/middlewares/requestLogger.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 60,
      functions: 80,
      lines: 80,
    },
  },
};
