// seeders/20260708130700-demo-tickets.js

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT o.id AS order_id, o.order_number, o.event_id, o.quantity,
             u.name AS attendee_name, u.email AS attendee_email, u.phone AS attendee_phone
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.order_number IN ('ORD-20260708-SEED01', 'ORD-20260708-SEED02', 'ORD-20260708-SEED06')
    `);

    const now = new Date();
    const tickets = [];
    let seq = 1;

    rows.forEach((row) => {
      const isPastEvent = row.order_number === 'ORD-20260708-SEED06';

      for (let i = 0; i < row.quantity; i += 1) {
        const code = `TIX-SEED-${String(seq).padStart(4, '0')}`;

        tickets.push({
          order_id: row.order_id,
          event_id: row.event_id,
          ticket_code: code,
          // Representasi sederhana; QR image sungguhan (base64/SVG) dibuat di Epic TIX
          qr_code: code,
          attendee_name: row.attendee_name,
          attendee_email: row.attendee_email,
          attendee_phone: row.attendee_phone,
          is_checked_in: isPastEvent,
          checked_in_at: isPastEvent ? new Date('2026-06-20T18:35:00+07:00') : null,
          created_at: isPastEvent ? new Date('2026-06-19T10:00:00+07:00') : now,
        });

        seq += 1;
      }
    });

    await queryInterface.bulkInsert('tickets', tickets);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("DELETE FROM tickets WHERE ticket_code LIKE 'TIX-SEED-%'");
  },
};
