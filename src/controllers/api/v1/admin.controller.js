// src/controllers/api/v1/admin.controller.js
'use strict';

const DashboardService = require('../../../services/dashboard.service');
const ApiResponse = require('../../../utils/ApiResponse');

class AdminController {
  /** DASH-02: GET /api/v1/admin/dashboard */
  static async getDashboard(req, res, next) {
    try {
      const dashboard = await DashboardService.getAdminDashboard();
      res.json(ApiResponse.success('OK', dashboard));
    } catch (err) {
      next(err);
    }
  }

  /** DASH-05: GET /api/v1/admin/reports/revenue */
  static async getRevenueReport(req, res, next) {
    try {
      const report = await DashboardService.getRevenueReport(req.query);
      res.json(ApiResponse.success('OK', report));
    } catch (err) {
      next(err);
    }
  }

  /** DASH-06: GET /api/v1/admin/reports/users */
  static async getUserReport(req, res, next) {
    try {
      const report = await DashboardService.getUserReport(req.query);
      res.json(ApiResponse.success('OK', report));
    } catch (err) {
      next(err);
    }
  }

  /** DASH-07: GET /api/v1/admin/reports/payments */
  static async getPaymentReport(req, res, next) {
    try {
      const report = await DashboardService.getPaymentReport(req.query);
      res.json(ApiResponse.success('OK', report));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminController;
