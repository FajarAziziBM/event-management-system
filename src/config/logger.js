// src/config/logger.js
'use strict';

const path = require('node:path');
const winston = require('winston');
require('winston-daily-rotate-file');

const config = require('./env');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logDir = path.resolve(process.cwd(), 'logs');

// Format untuk console (development) — ringkas & berwarna
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level}: ${stack || message}${metaStr}`;
  }),
);

// Format untuk file (production) — JSON terstruktur, gampang di-ingest log tool lain
const fileFormat = combine(timestamp(), errors({ stack: true }), json());

const dailyRotateTransport = new winston.transports.DailyRotateFile({
  dirname: logDir,
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
});

const errorRotateTransport = new winston.transports.DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

const logger = winston.createLogger({
  level: config.log.level,
  transports: [dailyRotateTransport, errorRotateTransport],
  exitOnError: false,
  silent: config.isTest,
});

// Console transport hanya aktif di luar production (di production cukup file/agent log)
if (!config.isProduction) {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

// Stream adapter untuk morgan (HTTP access log) — dipakai di app.js
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
