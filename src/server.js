// src/server.js
'use strict';

// HARUS baris pertama sebelum require lain apa pun — lihat src/instrument.js.
require('./instrument');

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const expireOrdersJob = require('./jobs/expireOrders.job');

const server = app.listen(config.app.port, () => {
  logger.info(`EMS server berjalan di ${config.app.url} (env: ${config.env})`);

  // CICD-05: di PM2 cluster mode (instances > 1), tiap instance akan
  // menjalankan file ini terpisah — tanpa guard ini, cron yg sama akan
  // terjadwal N kali (N = jumlah instance), semuanya berebut baris yang
  // sama tiap 5 menit. NODE_APP_INSTANCE cuma di-set PM2 saat cluster mode;
  // di luar itu (dev biasa, fork mode, Docker satu instance) nilainya
  // undefined, jadi tetap start seperti biasa.
  if (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0') {
    expireOrdersJob.start();
  } else {
    logger.info(
      `[cron:expireOrders] Dilewati di instance PM2 #${process.env.NODE_APP_INSTANCE} (sudah berjalan di instance #0)`,
    );
  }
});

function shutdown(signal) {
  logger.info(`Menerima ${signal}, mematikan server dengan baik...`);
  server.close(() => {
    logger.info('Server ditutup.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  if (config.monitoring.sentryDsn) {
    require('@sentry/node').captureException(reason);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  if (config.monitoring.sentryDsn) {
    require('@sentry/node').captureException(err);
  }
  process.exit(1);
});
