// migrations/20260708120200-create-events.js

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      creator_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      category_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      image_path: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      venue: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      event_end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      max_attendees: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ticket_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      available_ticket: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'closed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // DB-11: index performa untuk query "event published & akan datang"
    await queryInterface.addIndex('events', ['status', 'event_date'], {
      name: 'idx_events_status_event_date',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('events');
  },
};
