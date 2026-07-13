// src/validations/category.validation.js
'use strict';

const { body, param, validationResult } = require('express-validator');

const { ValidationError } = require('../utils/errors');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMap = {};
    errors.array().forEach((err) => {
      if (!errorMap[err.path]) {
        errorMap[err.path] = err.msg;
      }
    });
    return next(new ValidationError('Validasi input gagal', errorMap));
  }
  next();
}

/**
 * CAT-05: Validasi buat kategori — nama wajib diisi
 * (keunikan nama divalidasi di service layer karena butuh query DB)
 */
const validateCreateCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nama kategori wajib diisi')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama kategori harus 2-100 karakter'),
  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Deskripsi maksimal 500 karakter'),
  body('icon').optional({ nullable: true }).trim().isLength({ max: 100 }),
  handleValidationErrors,
];

/**
 * CAT-05: Validasi edit kategori — nama opsional (partial update), tapi jika
 * dikirim tidak boleh kosong
 */
const validateUpdateCategory = [
  param('id').isInt({ min: 1 }).withMessage('ID kategori tidak valid'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nama kategori tidak boleh kosong')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama kategori harus 2-100 karakter'),
  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Deskripsi maksimal 500 karakter'),
  body('icon').optional({ nullable: true }).trim().isLength({ max: 100 }),
  handleValidationErrors,
];

const validateCategoryId = [
  param('id').isInt({ min: 1 }).withMessage('ID kategori tidak valid'),
  handleValidationErrors,
];

module.exports = {
  validateCreateCategory,
  validateUpdateCategory,
  validateCategoryId,
};
