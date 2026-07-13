// src/controllers/api/v1/attachment.controller.js
'use strict';

const EventService = require('../../../services/event.service');
const ApiResponse = require('../../../utils/ApiResponse');

class AttachmentController {
  /** EVT-08: DELETE /api/v1/attachments/:id */
  static async remove(req, res, next) {
    try {
      const result = await EventService.deleteAttachment(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success(`Lampiran "${result.fileName}" berhasil dihapus`));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AttachmentController;
