// src/controllers/api/v1/adminUser.controller.js
'use strict';

const UserService = require('../../../services/user.service');
const ApiResponse = require('../../../utils/ApiResponse');

class AdminUserController {
  /** USR-01: GET /api/v1/admin/users */
  static async list(req, res, next) {
    try {
      const { users, pagination } = await UserService.listUsers(req.query);
      res.json(ApiResponse.success('OK', { users, pagination }));
    } catch (err) {
      next(err);
    }
  }

  /** Bonus: GET /api/v1/admin/users/:id — detail satu user */
  static async getById(req, res, next) {
    try {
      const user = await UserService.getUserById(req.params.id);
      res.json(ApiResponse.success('OK', user));
    } catch (err) {
      next(err);
    }
  }

  /** USR-02: POST /api/v1/admin/users */
  static async create(req, res, next) {
    try {
      const { name, email, password, role, phone } = req.body;
      const user = await UserService.createUser({ name, email, password, role, phone });
      res.status(201).json(ApiResponse.success('User berhasil dibuat', user));
    } catch (err) {
      next(err);
    }
  }

  /** USR-03: PUT /api/v1/admin/users/:id */
  static async update(req, res, next) {
    try {
      const { name, email, phone, avatar } = req.body;
      const user = await UserService.updateUser(req.params.id, { name, email, phone, avatar });
      res.json(ApiResponse.success('User berhasil diperbarui', user));
    } catch (err) {
      next(err);
    }
  }

  /** USR-04: DELETE /api/v1/admin/users/:id */
  static async remove(req, res, next) {
    try {
      const result = await UserService.deleteUser(req.params.id, req.user.id);
      res.json(ApiResponse.success(`User "${result.name}" berhasil dihapus`));
    } catch (err) {
      next(err);
    }
  }

  /** USR-05: PATCH /api/v1/admin/users/:id/role */
  static async changeRole(req, res, next) {
    try {
      const user = await UserService.changeRole(req.params.id, req.body.role, req.user.id);
      res.json(ApiResponse.success('Role user berhasil diubah', user));
    } catch (err) {
      next(err);
    }
  }

  /** USR-06: PATCH /api/v1/admin/users/:id/suspend */
  static async toggleSuspend(req, res, next) {
    try {
      const user = await UserService.toggleSuspend(
        req.params.id,
        req.body.isSuspended,
        req.user.id,
      );
      const message = req.body.isSuspended ? 'User berhasil disuspend' : 'User berhasil diaktifkan';
      res.json(ApiResponse.success(message, user));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminUserController;
