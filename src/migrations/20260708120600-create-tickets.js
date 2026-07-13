// src/migrations/20260708120600-create-tickets.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      event_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'events', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      ticket_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      qr_code: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      attendee_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      attendee_email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      attendee_phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_checked_in: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      checked_in_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tickets');
  },
};
