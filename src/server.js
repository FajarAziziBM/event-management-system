// src/server.js
'use strict';

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');

const server = app.listen(config.app.port, () => {
  logger.info(`EMS server berjalan di ${config.app.url} (env: ${config.env})`);
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
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});
