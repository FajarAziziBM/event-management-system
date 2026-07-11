// seeders/20260708130000-demo-admin.js
'use strict';

const bcrypt = require('bcrypt');

const config = require('../config/env');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const hashedPassword = await bcrypt.hash('ChangeMe123!', config.auth.bcryptSaltRounds);

    await queryInterface.bulkInsert('users', [
      {
        name: 'Admin EMS',
        // PENTING: ini kredensial default untuk development —
        // ganti password ini segera setelah seed pertama di environment manapun.
        email: 'admin@eventhub.local',
        password: hashedPassword,
        phone: null,
        role: 'admin',
        avatar: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: 'admin@eventhub.local' });
  },
};
