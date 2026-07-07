'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
// src/app.js

const express = require("express");
const env = require("./config/env");
const logger = require("./config/logger");
const requestLogger = require("./middlewares/requestLogger");

const logger = require('./config/logger');

const requestLogger = require('./middlewares/requestLogger');
const {
  notFoundHandler,
  errorHandler,
} = require('./middlewares/error.middleware');

const viewRoutes = require('./routes/viewRoutes');
const { flashMiddleware } = require('./utils/flash');

const app = express();

// =========================
// Global Middleware
// =========================

app.use(requestLogger);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

app.use(flashMiddleware);

// =========================
// View Engine
// =========================

app.set('view engine', 'ejs');
app.set('views', './src/views');

// Static Files
app.use(express.static('./src/public'));

// =========================
// Routes
// =========================

app.use('/', viewRoutes);

// =========================
// 404 Handler
// =========================

app.use(notFoundHandler);

// =========================
// Global Error Handler
// =========================

app.use(errorHandler);

console.log(`App running in ${env.env} mode`);

console.log(`App running in ${env.app.nodeEnv} mode`);

// routes
// app.use("/api/users", userRoutes);
// app.use("/api/events", eventRoutes);


// Global error handler (harus paling bawah)
app.use((err, req, res, next) => {
  logger.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
