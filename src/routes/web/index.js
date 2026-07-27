// src/routes/web/index.js
'use strict';

const express = require('express');

const authRoutes = require('./auth');
const eventsRoutes = require('./events');
const ordersRoutes = require('./orders');
const ticketsRoutes = require('./tickets');
const HomeWebController = require('../../controllers/web/home.controller');

const router = express.Router();

router.use('/auth', authRoutes);
router.use(eventsRoutes);
router.use(ordersRoutes);
router.use(ticketsRoutes);

router.get('/', HomeWebController.index);

router.get('/privacy', (req, res) => res.render('privacy', { title: 'Kebijakan Privasi' }));
router.get('/terms', (req, res) => res.render('terms', { title: 'Syarat & Ketentuan' }));

module.exports = router;
