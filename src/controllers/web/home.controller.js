// src/controllers/web/home.controller.js
'use strict';

const EventService = require('../../services/event.service');
const CategoryService = require('../../services/category.service');

const HomeWebController = {
  /** GET / — landing page: event mendatang + kategori populer */
  async index(req, res, next) {
    try {
      const [{ events, pagination }, categories] = await Promise.all([
        EventService.listPublicEvents({ limit: 6, page: 1 }),
        CategoryService.getAllCategories(),
      ]);

      res.render('index', {
        title: 'Beranda',
        activeNav: 'home',
        featuredEvents: events,
        totalPublishedEvents: pagination.totalItems,
        categories,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = HomeWebController;
