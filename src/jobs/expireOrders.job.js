// src/jobs/expireOrders.job.js
'use strict';

const cron = require('node-cron');

const OrderService = require('../services/order.service');
const logger = require('../config/logger');

/**
 * ORD-08: Jalan tiap 5 menit, cari order 'pending' yang sudah lewat expired_at
 * dan set jadi 'expired' + kembalikan available_ticket.
 * Logika sesungguhnya ada di OrderService.expirePendingOrders() supaya bisa
 * dites langsung tanpa menunggu jadwal cron — file ini murni pendaftaran jadwal.
 */
function start() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await OrderService.expirePendingOrders();
      if (result.expiredCount > 0) {
        logger.info(`[cron:expireOrders] ${result.expiredCount} order di-set expired otomatis`);
      }
    } catch (err) {
      logger.error('[cron:expireOrders] Gagal menjalankan job', { error: err.message });
    }
  });

  logger.info('[cron:expireOrders] Terjadwal setiap 5 menit');
}

module.exports = { start };
