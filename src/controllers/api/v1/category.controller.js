// src/controllers/api/v1/category.controller.js
'use strict';

const CategoryService = require('../../../services/category.service');
const ApiResponse = require('../../../utils/ApiResponse');

class CategoryController {
  /**
   * CAT-01: GET /api/v1/categories — publik, tidak butuh login
   */
  static async getAll(req, res, next) {
    try {
      const categories = await CategoryService.getAllCategories();
      res.json(ApiResponse.success('OK', categories));
    } catch (err) {
      next(err);
    }
  }

  /**
   * CAT-02: POST /api/v1/categories — admin only
   */
  static async create(req, res, next) {
    try {
      const { name, description, icon } = req.body;
      const category = await CategoryService.createCategory({ name, description, icon });
      res.status(201).json(ApiResponse.success('Kategori berhasil dibuat', category));
    } catch (err) {
      next(err);
    }
  }

  /**
   * CAT-03: PUT /api/v1/categories/:id — admin only
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, icon } = req.body;
      const category = await CategoryService.updateCategory(id, { name, description, icon });
      res.json(ApiResponse.success('Kategori berhasil diperbarui', category));
    } catch (err) {
      next(err);
    }
  }

  /**
   * CAT-04: DELETE /api/v1/categories/:id — admin only, guard bila masih dipakai event
   */
  static async remove(req, res, next) {
    try {
      const { id } = req.params;
      const result = await CategoryService.deleteCategory(id);
      res.json(ApiResponse.success(`Kategori "${result.name}" berhasil dihapus`));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CategoryController;
