// src/config/logger.js

const fs = require("fs");
const path = require("path");
const winston = require("winston");
require("winston-daily-rotate-file");

const logDir = process.env.LOG_DIR || "logs";

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({
    stack: true,
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),

  new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: "application-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    zippedArchive: true,
    level: process.env.LOG_LEVEL || "info",
  }),

  new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    zippedArchive: true,
    level: "error",
  }),
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports,
});

module.exports = logger;
