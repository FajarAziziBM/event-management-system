// routes/api/v1/auth.route.js

'use strict';

const express = require('express');
const AuthController = require('../../../controllers/api/v1/auth.controller');
const registerValidation = require('../../../validations/register.validation');
const validate = require('../../../middlewares/validate.middleware');
const loginValidation = require('../../../validations/login.validation');
const router = express.Router();

router.post(
  '/register',
  registerValidation,
  validate,
  AuthController.register,
);

router.post(
  '/login',
  loginValidation,
  validate,
  AuthController.login
);

module.exports = router;
