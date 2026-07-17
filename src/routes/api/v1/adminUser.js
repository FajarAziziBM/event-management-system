// src/routes/api/v1/adminUser.js
'use strict';

const express = require('express');

const AdminUserController = require('../../../controllers/api/v1/adminUser.controller');
const { authenticate, authorize } = require('../../../middlewares/auth.middleware');
const {
  validateListUsersQuery,
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
  validateChangeRole,
  validateSuspend,
} = require('../../../validations/user.validation');

const router = express.Router();

// Seluruh endpoint di sini admin-only.
router.get('/', authenticate, authorize('admin'), validateListUsersQuery, AdminUserController.list);
router.get('/:id', authenticate, authorize('admin'), validateUserId, AdminUserController.getById);
router.post('/', authenticate, authorize('admin'), validateCreateUser, AdminUserController.create);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateUpdateUser,
  AdminUserController.update,
);
router.delete('/:id', authenticate, authorize('admin'), validateUserId, AdminUserController.remove);
router.patch(
  '/:id/role',
  authenticate,
  authorize('admin'),
  validateChangeRole,
  AdminUserController.changeRole,
);
router.patch(
  '/:id/suspend',
  authenticate,
  authorize('admin'),
  validateSuspend,
  AdminUserController.toggleSuspend,
);

module.exports = router;
