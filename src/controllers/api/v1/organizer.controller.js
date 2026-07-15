// src/controllers/api/v1/organizer.controller.js
'use strict';

const EventService = require('../../../services/event.service');
const DashboardService = require('../../../services/dashboard.service');
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

  /** DASH-01: GET /api/v1/organizer/dashboard */
  static async getDashboard(req, res, next) {
    try {
      const dashboard = await DashboardService.getOrganizerDashboard(req.user.id);
      res.json(ApiResponse.success('OK', dashboard));
    } catch (err) {
      next(err);
    }
  }

  /** DASH-03: GET /api/v1/organizer/reports/sales */
  static async getSalesReport(req, res, next) {
    try {
      const report = await DashboardService.getSalesReport(req.user.id, req.query);
      res.json(ApiResponse.success('OK', report));
    } catch (err) {
      next(err);
    }
  }

  /** DASH-04: GET /api/v1/organizer/reports/event-performance */
  static async getEventPerformanceReport(req, res, next) {
    try {
      const report = await DashboardService.getEventPerformanceReport(req.user.id);
      res.json(ApiResponse.success('OK', report));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OrganizerController;
