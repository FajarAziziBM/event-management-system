// src/seeders/20260708130300-demo-events.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ID sudah diketahui dari urutan seeder sebelumnya:
    // demo-admin: id 1
    // demo-organizers-customers: id 2 (budi), 3 (sinta)
    // demo-categories: id 1 (Konser), 2 (Workshop), 3 (Seminar), 4 (Olahraga), 5 (Kuliner), 6 (Pameran), 7 (Komunitas), 8 (Lainnya)
    const budiId = 2;
    const sintaId = 3;
    const categoryIds = {
      konser: 1,
      workshop: 2,
      seminar: 3,
      olahraga: 4,
      kuliner: 5,
      pameran: 6,
      komunitas: 7,
      lainnya: 8,
    };

    const now = new Date();

    await queryInterface.bulkInsert('events', [
      {
        creator_id: budiId,
        category_id: categoryIds.konser,
        title: 'Konser Musik Indie Jakarta 2026',
        slug: 'konser-musik-indie-jakarta-2026',
        description: 'Konser musik indie dengan line-up band lokal terbaik se-Jabodetabek.',
        image_path: null,
        venue: 'GBK Senayan, Jakarta',
        address: 'Jl. Pintu Satu Senayan, Jakarta Pusat',
        latitude: -6.2183,
        longitude: 106.8027,
        event_date: new Date('2026-09-01T19:00:00+07:00'),
        event_end_date: new Date('2026-09-01T23:00:00+07:00'),
        max_attendees: 500,
        ticket_price: 150000,
        available_ticket: 498, // 2 terjual (SEED01), 2 dari order batal sudah balik lagi
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        creator_id: budiId,
        category_id: categoryIds.workshop,
        title: 'Workshop Digital Marketing untuk UMKM',
        slug: 'workshop-digital-marketing-untuk-umkm',
        description: 'Belajar strategi digital marketing praktis untuk UMKM naik kelas.',
        image_path: null,
        venue: 'Coworking Space Kemang',
        address: 'Jl. Kemang Raya No. 10, Jakarta Selatan',
        latitude: -6.2608,
        longitude: 106.8135,
        event_date: new Date('2026-08-20T09:00:00+07:00'),
        event_end_date: new Date('2026-08-20T16:00:00+07:00'),
        max_attendees: 50,
        ticket_price: 250000,
        available_ticket: 49, // 1 terjual (SEED02)
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        creator_id: sintaId,
        category_id: categoryIds.seminar,
        title: 'Seminar Teknologi AI 2026',
        slug: 'seminar-teknologi-ai-2026',
        description: 'Diskusi tren AI terbaru bersama praktisi industri teknologi.',
        image_path: null,
        venue: 'Hotel Mulia, Jakarta',
        address: 'Jl. Asia Afrika, Jakarta Pusat',
        latitude: -6.2146,
        longitude: 106.8206,
        event_date: new Date('2026-09-15T08:30:00+07:00'),
        event_end_date: new Date('2026-09-15T17:00:00+07:00'),
        max_attendees: 200,
        ticket_price: 100000,
        available_ticket: 197, // 3 masih di-hold (SEED03, pending)
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        creator_id: sintaId,
        category_id: categoryIds.olahraga,
        title: 'Fun Run 5K Jakarta',
        slug: 'fun-run-5k-jakarta',
        description: 'Lari santai 5K mengelilingi kawasan Sudirman-Thamrin.',
        image_path: null,
        venue: 'Bundaran HI, Jakarta',
        address: 'Bundaran Hotel Indonesia, Jakarta Pusat',
        latitude: -6.1954,
        longitude: 106.8231,
        event_date: new Date('2026-10-10T06:00:00+07:00'),
        event_end_date: new Date('2026-10-10T09:00:00+07:00'),
        max_attendees: 1000,
        ticket_price: 75000,
        available_ticket: 1000, // masih draft, belum ada order
        status: 'draft',
        created_at: now,
        updated_at: now,
      },
      {
        creator_id: budiId,
        category_id: categoryIds.kuliner,
        title: 'Festival Kuliner Nusantara',
        slug: 'festival-kuliner-nusantara',
        description: 'Menjelajah ragam kuliner khas nusantara dari 50+ tenant.',
        image_path: null,
        venue: 'Lapangan Banteng, Jakarta',
        address: 'Jl. Lapangan Banteng, Jakarta Pusat',
        latitude: -6.1709,
        longitude: 106.8317,
        event_date: new Date('2026-08-29T10:00:00+07:00'),
        event_end_date: new Date('2026-08-31T22:00:00+07:00'),
        max_attendees: 300,
        ticket_price: 50000,
        available_ticket: 300, // order SEED04 expired -> kuota balik penuh
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        creator_id: sintaId,
        category_id: categoryIds.komunitas,
        title: 'Meetup Developer Jakarta #12',
        slug: 'meetup-developer-jakarta-12',
        description: 'Meetup rutin komunitas developer Jakarta, sharing session & networking.',
        image_path: null,
        venue: 'Kantor Tokopedia Tower',
        address: 'Jl. Prof. Dr. Satrio, Jakarta Selatan',
        latitude: -6.2249,
        longitude: 106.8081,
        event_date: new Date('2026-06-20T18:30:00+07:00'), // sudah lewat -> event lampau
        event_end_date: new Date('2026-06-20T21:00:00+07:00'),
        max_attendees: 80,
        ticket_price: 0,
        available_ticket: 79, // 1 terjual (SEED06, sudah check-in)
        status: 'closed',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('events', {
      slug: [
        'konser-musik-indie-jakarta-2026',
        'workshop-digital-marketing-untuk-umkm',
        'seminar-teknologi-ai-2026',
        'fun-run-5k-jakarta',
        'festival-kuliner-nusantara',
        'meetup-developer-jakarta-12',
      ],
    });
  },
};
