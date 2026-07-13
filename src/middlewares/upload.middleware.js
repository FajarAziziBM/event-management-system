// src/middlewares/upload.middleware.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const config = require('../config/env');
const { ValidationError } = require('../utils/errors');

const UPLOAD_ROOT = path.resolve(process.cwd(), config.upload.dir);
const BANNER_DIR = path.join(UPLOAD_ROOT, 'events', 'banners');
const ATTACHMENT_DIR = path.join(UPLOAD_ROOT, 'events', 'attachments');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const bannerStorage = multer.diskStorage({
  destination(req, file, cb) {
    ensureDir(BANNER_DIR);
    cb(null, BANNER_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `event-${req.params.id}-${Date.now()}${ext}`);
  },
});

const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    ensureDir(ATTACHMENT_DIR);
    cb(null, ATTACHMENT_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 50);
    cb(null, `event-${req.params.id}-${base}-${Date.now()}${ext}`);
  },
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function imageFileFilter(req, file, cb) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(new ValidationError('Tipe file banner harus JPG, PNG, atau WEBP'));
    return;
  }
  cb(null, true);
}

function attachmentFileFilter(req, file, cb) {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
    cb(
      new ValidationError(
        'Tipe file lampiran tidak didukung (gunakan PDF, DOC, DOCX, atau gambar)',
      ),
    );
    return;
  }
  cb(null, true);
}

const maxFileSize = config.upload.maxFileSizeMb * 1024 * 1024;

const bannerUpload = multer({
  storage: bannerStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: maxFileSize },
});
const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: { fileSize: maxFileSize },
});

/**
 * Bungkus middleware Multer supaya MulterError (mis. LIMIT_FILE_SIZE) ikut
 * masuk ke format error envelope standar kita, bukan error mentah Multer.
 */
function wrapMulter(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError(`Ukuran file maksimal ${config.upload.maxFileSizeMb}MB`));
        }
        return next(new ValidationError(err.message));
      }
      if (err) {
        return next(err); // sudah ValidationError dari fileFilter, atau error lain
      }
      next();
    });
  };
}

module.exports = {
  uploadBanner: wrapMulter(bannerUpload.single('banner')),
  uploadAttachment: wrapMulter(attachmentUpload.single('attachment')),
};
