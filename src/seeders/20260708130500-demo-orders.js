// src/seeders/20260708130500-demo-orders.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // User ID dari demo-organizers-customers:
    // andi@example.com = 4, citra@example.com = 5, doni@example.com = 6
    // Event ID dari demo-events:
    // konser (1), workshop (2), seminar (3), kuliner (5), meetup (6)
    const andiId = 4;
    const citraId = 5;
    const doniId = 6;
    const eventIds = {
      konser: 1,
      workshop: 2,
      seminar: 3,
      kuliner: 5,
      meetup: 6,
    };
    const now = new Date();
    const pastEventTime = new Date('2026-06-19T10:00:00+07:00');

    await queryInterface.bulkInsert('orders', [
      {
        // Lunas, tiket sudah terbit (lihat seeder tickets)
        order_number: 'ORD-20260708-SEED01',
        user_id: andiId,
        event_id: eventIds.konser,
        quantity: 2,
        subtotal: 300000,
        service_fee: 5000,
        total_amount: 305000,
        payment_status: 'paid',
        payment_method: 'VIRTUAL_ACCOUNT',
        expired_at: null,
        paid_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        // Lunas via e-wallet
        order_number: 'ORD-20260708-SEED02',
        user_id: citraId,
        event_id: eventIds.workshop,
        quantity: 1,
        subtotal: 250000,
        service_fee: 5000,
        total_amount: 255000,
        payment_status: 'paid',
        payment_method: 'EWALLET',
        expired_at: null,
        paid_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        // Masih menunggu pembayaran (invoice belum expired)
        order_number: 'ORD-20260708-SEED03',
        user_id: doniId,
        event_id: eventIds.seminar,
        quantity: 3,
        subtotal: 300000,
        service_fee: 5000,
        total_amount: 305000,
        payment_status: 'pending',
        payment_method: null,
        expired_at: new Date(now.getTime() + 60 * 60 * 1000),
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        // Lewat batas waktu, kuota sudah dikembalikan ke event
        order_number: 'ORD-20260708-SEED04',
        user_id: andiId,
        event_id: eventIds.kuliner,
        quantity: 1,
        subtotal: 50000,
        service_fee: 2000,
        total_amount: 52000,
        payment_status: 'expired',
        payment_method: null,
        expired_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        paid_at: null,
        created_at: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        // Dibatalkan customer sebelum bayar
        order_number: 'ORD-20260708-SEED05',
        user_id: citraId,
        event_id: eventIds.konser,
        quantity: 2,
        subtotal: 300000,
        service_fee: 5000,
        total_amount: 305000,
        payment_status: 'cancelled',
        payment_method: null,
        expired_at: null,
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        // Event komunitas gratis di masa lalu, sudah dihadiri (lihat seeder tickets)
        order_number: 'ORD-20260708-SEED06',
        user_id: doniId,
        event_id: eventIds.meetup,
        quantity: 1,
        subtotal: 0,
        service_fee: 0,
        total_amount: 0,
        payment_status: 'paid',
        payment_method: 'FREE',
        expired_at: null,
        paid_at: pastEventTime,
        created_at: pastEventTime,
        updated_at: pastEventTime,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('orders', {
      order_number: [
        'ORD-20260708-SEED01',
        'ORD-20260708-SEED02',
        'ORD-20260708-SEED03',
        'ORD-20260708-SEED04',
        'ORD-20260708-SEED05',
        'ORD-20260708-SEED06',
      ],
    });
  },
};
