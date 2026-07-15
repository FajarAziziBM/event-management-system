// src/utils/simpleCache.js
'use strict';

/**
 * Cache in-process sederhana (bukan Redis) — cukup untuk skala proyek ini.
 * Dipakai HANYA untuk endpoint agregasi admin yang platform-wide (DASH-02,
 * 05, 06, 07); endpoint organizer TIDAK di-cache karena scope datanya kecil
 * (per-organizer) dan mereka wajar mengharapkan data real-time untuk bisnis
 * mereka sendiri. TTL pendek (default 60 detik) supaya data tidak terlalu basi.
 */
class SimpleCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 60000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

module.exports = new SimpleCache();
