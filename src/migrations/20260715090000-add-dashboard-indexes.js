// src/migrations/20260715090000-add-dashboard-indexes.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // DASH-08: laporan penjualan/revenue selalu filter payment_status='paid'
    // lalu grup/rentang berdasarkan paid_at — composite index ini melayani
    // kedua pola sekaligus (filter di kolom pertama, range di kolom kedua).
    await queryInterface.addIndex('orders', ['payment_status', 'paid_at'], {
      name: 'idx_orders_status_paid_at',
    });

    // DASH-02/06: hitung & filter user per role di admin dashboard/report
    await queryInterface.addIndex('users', ['role'], {
      name: 'idx_users_role',
    });

    // DASH-04: hitung tiket & check-in rate per event
    await queryInterface.addIndex('tickets', ['event_id', 'is_checked_in'], {
      name: 'idx_tickets_event_checkedin',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('orders', 'idx_orders_status_paid_at');
    await queryInterface.removeIndex('users', 'idx_users_role');
    await queryInterface.removeIndex('tickets', 'idx_tickets_event_checkedin');
  },
};
