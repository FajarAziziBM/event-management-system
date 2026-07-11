// src/utils/slugify.js

'use strict';

/**
 * Ubah teks bebas jadi slug URL-safe: lowercase, tanpa diakritik,
 * spasi/simbol jadi tanda hubung tunggal, tanpa tanda hubung di ujung.
 */
function slugify(text) {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = slugify;
