// src/utils/ApiResponse.js
'use strict';

/**
 * Standar envelope response API — lihat docs/specification.md §6.
 *
 *   sukses : { success: true,  message, data }
 *   error  : { success: false, message, errors }
 */
class ApiResponse {
  static success(message, data = null) {
    return { success: true, message, data };
  }

  static error(message, errors = null) {
    return { success: false, message, errors };
  }
}

module.exports = ApiResponse;
