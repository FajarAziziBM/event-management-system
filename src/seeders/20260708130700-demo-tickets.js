// src/seeders/20260708130700-demo-tickets.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Data hardcoded dari demo-orders & demo-organizers-customers:
    // SEED01: order_id=1, event_id=1, qty=2, Andi (andi@example.com, 081234567803)
    // SEED02: order_id=2, event_id=2, qty=1, Citra (citra@example.com, 081234567804)
    // SEED06: order_id=6, event_id=6, qty=1, Doni (doni@example.com, 081234567805) - past event, checked in
    const now = new Date();
    const pastEventTime = new Date('2026-06-19T10:00:00+07:00');

    const tickets = [
      // SEED01 tickets (Andi, Konser)
      {
        order_id: 1,
        event_id: 1,
        ticket_code: 'TIX-SEED-0001',
        qr_code: 'TIX-SEED-0001',
        attendee_name: 'Andi Pratama',
        attendee_email: 'andi@example.com',
        attendee_phone: '081234567803',
        is_checked_in: false,
        checked_in_at: null,
        created_at: now,
      },
      {
        order_id: 1,
        event_id: 1,
        ticket_code: 'TIX-SEED-0002',
        qr_code: 'TIX-SEED-0002',
        attendee_name: 'Andi Pratama',
        attendee_email: 'andi@example.com',
        attendee_phone: '081234567803',
        is_checked_in: false,
        checked_in_at: null,
        created_at: now,
      },
      // SEED02 ticket (Citra, Workshop)
      {
        order_id: 2,
        event_id: 2,
        ticket_code: 'TIX-SEED-0003',
        qr_code: 'TIX-SEED-0003',
        attendee_name: 'Citra Dewi',
        attendee_email: 'citra@example.com',
        attendee_phone: '081234567804',
        is_checked_in: false,
        checked_in_at: null,
        created_at: now,
      },
      // SEED06 ticket (Doni, Meetup, past event, checked in)
      {
        order_id: 6,
        event_id: 6,
        ticket_code: 'TIX-SEED-0004',
        qr_code: 'TIX-SEED-0004',
        attendee_name: 'Doni Kurniawan',
        attendee_email: 'doni@example.com',
        attendee_phone: '081234567805',
        is_checked_in: true,
        checked_in_at: new Date('2026-06-20T18:35:00+07:00'),
        created_at: pastEventTime,
      },
    ];

    await queryInterface.bulkInsert('tickets', tickets);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("DELETE FROM tickets WHERE ticket_code LIKE 'TIX-SEED-%'");
  },
};
