// src/validations/event.validation.js
'use strict';

const { body, param, query, validationResult } = require('express-validator');

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

const eventIdParam = param('id').isInt({ min: 1 }).withMessage('ID event tidak valid');

const validateCreateEvent = [
  body('categoryId').isInt({ min: 1 }).withMessage('categoryId wajib diisi dan valid'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Judul event wajib diisi')
    .isLength({ min: 5, max: 200 })
    .withMessage('Judul harus 5-200 karakter'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('venue').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('address').optional({ nullable: true }).trim(),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('eventDate').isISO8601().withMessage('eventDate wajib format tanggal valid (ISO 8601)'),
  body('eventEndDate')
    .isISO8601()
    .withMessage('eventEndDate wajib format tanggal valid (ISO 8601)')
    .custom((value, { req }) => new Date(value) > new Date(req.body.eventDate))
    .withMessage('eventEndDate harus setelah eventDate'),
  body('maxAttendees').isInt({ min: 1 }).withMessage('maxAttendees wajib angka positif'),
  body('ticketPrice').isFloat({ min: 0 }).withMessage('ticketPrice tidak boleh negatif'),
  handleValidationErrors,
];

const validateUpdateEvent = [
  eventIdParam,
  body('categoryId').optional().isInt({ min: 1 }).withMessage('categoryId tidak valid'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Judul tidak boleh kosong')
    .isLength({ min: 5, max: 200 })
    .withMessage('Judul harus 5-200 karakter'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('venue').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('address').optional({ nullable: true }).trim(),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('eventDate').optional().isISO8601().withMessage('eventDate harus format tanggal valid'),
  body('eventEndDate')
    .optional()
    .isISO8601()
    .withMessage('eventEndDate harus format tanggal valid'),
  body('maxAttendees').optional().isInt({ min: 1 }).withMessage('maxAttendees wajib angka positif'),
  body('ticketPrice').optional().isFloat({ min: 0 }).withMessage('ticketPrice tidak boleh negatif'),
  handleValidationErrors,
];

const validateEventId = [eventIdParam, handleValidationErrors];

const validateUnpublish = [
  eventIdParam,
  body('targetStatus')
    .optional()
    .isIn(['draft', 'closed'])
    .withMessage("targetStatus harus 'draft' atau 'closed'"),
  handleValidationErrors,
];

const validateAttachmentId = [
  param('id').isInt({ min: 1 }).withMessage('ID lampiran tidak valid'),
  handleValidationErrors,
];

const validateListQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isInt({ min: 1 }),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  handleValidationErrors,
];

module.exports = {
  validateCreateEvent,
  validateUpdateEvent,
  validateEventId,
  validateUnpublish,
  validateAttachmentId,
  validateListQuery,
};
