// src/seeders/20260708130200-demo-organizers-customers.js
'use strict';

const bcrypt = require('bcrypt');

const config = require('../config/env');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const hashedPassword = await bcrypt.hash('Password123!', config.auth.bcryptSaltRounds);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        name: 'Budi Santoso',
        email: 'budi.organizer@eventhub.local',
        password: hashedPassword,
        phone: '081234567801',
        role: 'organizer',
        avatar: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Sinta Wijaya',
        email: 'sinta.organizer@eventhub.local',
        password: hashedPassword,
        phone: '081234567802',
        role: 'organizer',
        avatar: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Andi Pratama',
        email: 'andi@example.com',
        password: hashedPassword,
        phone: '081234567803',
        role: 'customer',
        avatar: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Citra Dewi',
        email: 'citra@example.com',
        password: hashedPassword,
        phone: '081234567804',
        role: 'customer',
        avatar: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Doni Kurniawan',
        email: 'doni@example.com',
        password: hashedPassword,
        phone: '081234567805',
        role: 'customer',
        avatar: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: [
        'budi.organizer@eventhub.local',
        'sinta.organizer@eventhub.local',
        'andi@example.com',
        'citra@example.com',
        'doni@example.com',
      ],
    });
  },
};
