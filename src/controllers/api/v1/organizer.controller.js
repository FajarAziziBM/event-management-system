// src/controllers/api/v1/organizer.controller.js
'use strict';

const EventService = require('../../../services/event.service');
const ApiResponse = require('../../../utils/ApiResponse');

class OrganizerController {
  /** EVT-12: GET /api/v1/organizer/events/:id/statistics */
  static async getEventStatistics(req, res, next) {
    try {
      const stats = await EventService.getEventStatistics(
        req.params.id,
        req.user.id,
        req.user.role,
      );
      res.json(ApiResponse.success('OK', stats));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OrganizerController;
