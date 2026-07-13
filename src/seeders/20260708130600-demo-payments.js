// src/seeders/20260708130600-demo-payments.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Order ID dari demo-orders: SEED01-06 = id 1-6
    const now = new Date();
    const pastEventTime = new Date('2026-06-19T10:00:00+07:00');

    await queryInterface.bulkInsert('payments', [
      {
        order_id: 1,
        provider: 'xendit',
        invoice_id: 'seed-inv-000001',
        external_id: 'ORD-20260708-SEED01',
        payment_url: 'https://checkout-staging.xendit.co/web/seed-inv-000001',
        status: 'paid',
        expired_at: new Date(now.getTime() + 60 * 60 * 1000),
        paid_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        order_id: 2,
        provider: 'xendit',
        invoice_id: 'seed-inv-000002',
        external_id: 'ORD-20260708-SEED02',
        payment_url: 'https://checkout-staging.xendit.co/web/seed-inv-000002',
        status: 'paid',
        expired_at: new Date(now.getTime() + 60 * 60 * 1000),
        paid_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        order_id: 3,
        provider: 'xendit',
        invoice_id: 'seed-inv-000003',
        external_id: 'ORD-20260708-SEED03',
        payment_url: 'https://checkout-staging.xendit.co/web/seed-inv-000003',
        status: 'pending',
        expired_at: new Date(now.getTime() + 60 * 60 * 1000),
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        order_id: 4,
        provider: 'xendit',
        invoice_id: 'seed-inv-000004',
        external_id: 'ORD-20260708-SEED04',
        payment_url: 'https://checkout-staging.xendit.co/web/seed-inv-000004',
        status: 'expired',
        expired_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        paid_at: null,
        created_at: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        // Invoice sempat terbuat, tapi customer batal sebelum bayar -> tetap 'pending' di sisi Xendit
        order_id: 5,
        provider: 'xendit',
        invoice_id: 'seed-inv-000005',
        external_id: 'ORD-20260708-SEED05',
        payment_url: 'https://checkout-staging.xendit.co/web/seed-inv-000005',
        status: 'pending',
        expired_at: new Date(now.getTime() + 60 * 60 * 1000),
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        order_id: 6,
        provider: 'xendit',
        invoice_id: 'seed-inv-000006',
        external_id: 'ORD-20260708-SEED06',
        payment_url: 'https://checkout-staging.xendit.co/web/seed-inv-000006',
        status: 'paid',
        expired_at: new Date(pastEventTime.getTime() + 60 * 60 * 1000),
        paid_at: pastEventTime,
        created_at: pastEventTime,
        updated_at: pastEventTime,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('payments', {
      external_id: [
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
