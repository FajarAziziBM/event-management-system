// src/routes/api/v1/category.js
'use strict';

const express = require('express');

const CategoryController = require('../../../controllers/api/v1/category.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const {
  validateCreateCategory,
  validateUpdateCategory,
  validateCategoryId,
} = require('../../../validations/category.validation');

const router = express.Router();

// CAT-01: publik, tidak butuh authenticate
router.get('/', CategoryController.getAll);

// CAT-02, CAT-03, CAT-04: admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateCreateCategory,
  CategoryController.create,
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateUpdateCategory,
  CategoryController.update,
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validateCategoryId,
  CategoryController.remove,
);

module.exports = router;
