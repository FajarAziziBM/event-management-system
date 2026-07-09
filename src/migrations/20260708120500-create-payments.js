// migrations/20260708120500-create-payments.js

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true, // relasi 1:1 dengan orders
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'xendit',
      },
      invoice_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      external_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      payment_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'expired', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      expired_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Lookup cepat saat webhook Xendit masuk (dicari berdasarkan external_id/invoice_id)
    await queryInterface.addIndex('payments', ['external_id'], {
      name: 'idx_payments_external_id',
    });
    await queryInterface.addIndex('payments', ['invoice_id'], {
      name: 'idx_payments_invoice_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
  },
};
