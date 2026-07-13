// src/seeders/20260708130400-demo-event-attachments.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Event ID dari demo-events:
    // konser-musik-indie-jakarta-2026 = id 1
    // seminar-teknologi-ai-2026 = id 3
    const now = new Date();

    // Catatan: file_path di sini hanya representasi skema (belum ada file fisik
    // di src/public/uploads) — file sungguhan akan diisi lewat endpoint upload
    // di Epic EVT (EVT-06/EVT-07).
    await queryInterface.bulkInsert('event_attachments', [
      {
        event_id: 1,
        file_name: 'rundown-acara.pdf',
        file_path: 'uploads/events/seed/rundown-acara.pdf',
        file_type: 'application/pdf',
        created_at: now,
      },
      {
        event_id: 3,
        file_name: 'materi-presentasi.pdf',
        file_path: 'uploads/events/seed/materi-presentasi.pdf',
        file_type: 'application/pdf',
        created_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('event_attachments', {
      file_name: ['rundown-acara.pdf', 'materi-presentasi.pdf'],
    });
  },
};
