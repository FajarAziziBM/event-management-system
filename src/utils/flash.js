// src/utils/flash.js
'use strict';

const FLASH_COOKIE = 'flash';

/**
 * Flash message untuk halaman EJS TANPA perlu express-session — cukup satu
 * cookie berumur pendek yang dibaca & langsung dihapus di request berikutnya.
 * Konsisten dengan arsitektur auth kita yang stateless (JWT), tidak perlu
 * menambah infrastruktur session hanya untuk notifikasi sekali-tampil.
 */
function setFlash(res, type, message) {
  res.cookie(FLASH_COOKIE, JSON.stringify({ type, message }), {
    httpOnly: true,
    maxAge: 5000,
  });
}

function flashMiddleware(req, res, next) {
  const raw = req.cookies ? req.cookies[FLASH_COOKIE] : undefined;
  res.locals.flash = null;

  if (raw) {
    try {
      res.locals.flash = JSON.parse(raw);
    } catch {
      res.locals.flash = null;
    }
    res.clearCookie(FLASH_COOKIE);
  }

  next();
}

module.exports = { setFlash, flashMiddleware };
