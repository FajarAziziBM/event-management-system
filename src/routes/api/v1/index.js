// src/routes/api/v1/index.js
'use strict';

const express = require('express');

const ApiResponse = require('../../../utils/ApiResponse');
const db = require('../../../models');
const logger = require('../../../config/logger');
const authRoutes = require('./auth');
const categoryRoutes = require('./category');
const eventRoutes = require('./event');
const attachmentRoutes = require('./attachment');
const organizerRoutes = require('./organizer');
const orderRoutes = require('./order');
const ticketRoutes = require('./ticket');
const adminRoutes = require('./admin');
const adminUserRoutes = require('./adminUser');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/events', eventRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/organizer', organizerRoutes);
router.use('/orders', orderRoutes);
router.use('/tickets', ticketRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/admin', adminRoutes);

router.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'unknown',
  };

  let timeoutHandle;
  try {
    // authenticate() = ping ringan (SELECT 1 setara), bukan query bisnis apa
    // pun — endpoint ini dipanggil sering oleh uptime monitor (CICD-07),
    // sengaja dibuat semurah mungkin. Di-race dgn timeout 3 detik supaya
    // endpoint TETAP cepat merespons walau DB benar-benar tidak terjangkau
    // (default acquire-timeout pool Sequelize 60 detik, jauh terlalu lambat
    // utk endpoint yang tujuannya justru mendeteksi masalah secepat mungkin).
    await Promise.race([
      db.sequelize.authenticate(),
      new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('DB check timeout')), 3000);
      }),
    ]);
    health.database = 'connected';
    return res.json(ApiResponse.success('OK', health));
  } catch (err) {
    health.database = 'disconnected';
    logger.error(`[health] Database check gagal: ${err.message}`);
    // 503 (bukan 200) itu ESENSI dari health check yang berguna — proses
    // Node bisa saja tetap hidup & merespons meski database-nya total tidak
    // bisa diakses; uptime monitor/orchestrator perlu tahu beda "hidup" dari
    // "benar-benar bisa melayani request".
    return res.status(503).json(ApiResponse.error('Database tidak dapat diakses', health));
  } finally {
    // PENTING: tanpa ini, timer 3 detik di atas terus "hidup" di background
    // stiap kali authenticate() menang duluan (kasus normal/tersering) —
    // remeh utk satu request, tapi nyata menghambat proses keluar bersih
    // (persis ini yg bikin Jest "did not exit" saat test suite ini jalan).
    clearTimeout(timeoutHandle);
  }
});

module.exports = router;
