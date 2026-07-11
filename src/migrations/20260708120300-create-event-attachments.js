// migrations/20260708120300-create-event-attachments.js

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('event_attachments', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      event_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'events', key: 'id' },
        onUpdate: 'CASCADE',
        // Lampiran tidak bermakna tanpa event induknya -> ikut terhapus
        onDelete: 'CASCADE',
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file_path: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file_type: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable('event_attachments');
  },
};
