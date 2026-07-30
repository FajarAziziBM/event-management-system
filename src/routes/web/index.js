// src/routes/web/index.js
'use strict';

const express = require('express');

const authRoutes = require('./auth');
const eventsRoutes = require('./events');
const ordersRoutes = require('./orders');
const ticketsRoutes = require('./tickets');
const HomeWebController = require('../../controllers/web/home.controller');
const { attachCsrfToken } = require('../../middlewares/csrf.middleware');

const router = express.Router();

// SEC-06: isi res.locals.csrfToken di SETIAP rute web (bukan /api/v1 atau
// webhook — keduanya tidak pakai form EJS, jadi sengaja tidak dibebani
// dependency ke CSRF_SECRET). Form mana pun tinggal:
// <input type="hidden" name="_csrf" value="<%= csrfToken %>">
router.use(attachCsrfToken);

router.use('/auth', authRoutes);
router.use(eventsRoutes);
router.use(ordersRoutes);
router.use(ticketsRoutes);

router.get('/', HomeWebController.index);

router.get('/privacy', (req, res) => res.render('privacy', { title: 'Kebijakan Privasi' }));
router.get('/terms', (req, res) => res.render('terms', { title: 'Syarat & Ketentuan' }));

module.exports = router;
