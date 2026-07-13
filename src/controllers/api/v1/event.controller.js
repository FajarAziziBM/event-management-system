// src/controllers/api/v1/event.controller.js
'use strict';

const EventService = require('../../../services/event.service');
const ApiResponse = require('../../../utils/ApiResponse');

class EventController {
  /** EVT-09 & EVT-11: GET /api/v1/events — publik, filter & pagination */
  static async list(req, res, next) {
    try {
      const { events, pagination } = await EventService.listPublicEvents(req.query);
      res.json(ApiResponse.success('OK', { events, pagination }));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-10: GET /api/v1/events/:slug — publik (draft/cancelled hanya utk owner/admin) */
  static async getBySlug(req, res, next) {
    try {
      const event = await EventService.getEventBySlug(req.params.slug, req.user);
      res.json(ApiResponse.success('OK', event));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-01: POST /api/v1/events */
  static async create(req, res, next) {
    try {
      const event = await EventService.createEvent(req.user.id, req.body);
      res.status(201).json(ApiResponse.success('Event berhasil dibuat', event));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-02: PUT /api/v1/events/:id */
  static async update(req, res, next) {
    try {
      const event = await EventService.updateEvent(
        req.params.id,
        req.user.id,
        req.user.role,
        req.body,
      );
      res.json(ApiResponse.success('Event berhasil diperbarui', event));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-03: DELETE /api/v1/events/:id */
  static async remove(req, res, next) {
    try {
      const result = await EventService.deleteEvent(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success(`Event "${result.title}" berhasil dihapus`));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-04: PATCH /api/v1/events/:id/publish */
  static async publish(req, res, next) {
    try {
      const event = await EventService.publishEvent(req.params.id, req.user.id, req.user.role);
      res.json(ApiResponse.success('Event berhasil dipublikasikan', event));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-05: PATCH /api/v1/events/:id/unpublish */
  static async unpublish(req, res, next) {
    try {
      const targetStatus = req.body.targetStatus || 'draft';
      const event = await EventService.unpublishEvent(
        req.params.id,
        req.user.id,
        req.user.role,
        targetStatus,
      );
      res.json(ApiResponse.success(`Event berhasil diubah ke status '${targetStatus}'`, event));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-06: POST /api/v1/events/:id/banner */
  static async uploadBanner(req, res, next) {
    try {
      const event = await EventService.uploadBanner(
        req.params.id,
        req.user.id,
        req.user.role,
        req.file,
      );
      res.json(ApiResponse.success('Banner berhasil diupload', event));
    } catch (err) {
      next(err);
    }
  }

  /** EVT-07: POST /api/v1/events/:id/attachments */
  static async uploadAttachment(req, res, next) {
    try {
      const attachment = await EventService.uploadAttachment(
        req.params.id,
        req.user.id,
        req.user.role,
        req.file,
      );
      res.status(201).json(ApiResponse.success('Lampiran berhasil diupload', attachment));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = EventController;
