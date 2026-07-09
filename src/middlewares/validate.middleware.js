'use strict';

const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

module.exports = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json(
    ApiResponse.error(
      'Validation failed',
      errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    ),
  );
};
