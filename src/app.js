// src/app.js

'use strict';

const path = require('node:path');

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./config/env');
const logger = require('./config/logger');
const { flashMiddleware } = require('./utils/flash');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// --- View engine (SETUP-09) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);

// --- Body & cookie parsing ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.auth.cookieSecret));

// --- Static assets ---
app.use(express.static(path.join(__dirname, 'public')));

// --- HTTP access log (SETUP-06) — dipipe ke Winston, bukan stdout langsung ---
app.use(morgan('combined', { stream: logger.stream }));

// --- Security middleware (helmet, cors, rate-limit) → lihat Epic SEC ---

// --- Flash message berbasis cookie (SETUP-09), tanpa express-session ---
app.use(flashMiddleware);

// --- Routes ---
app.use(routes);

// --- 404 & global error handler (SETUP-07) — HARUS paling akhir ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
