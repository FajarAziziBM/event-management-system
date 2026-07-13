// src/models/payment.model.js
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true, // relasi 1:1 dengan orders
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'xendit',
      },
      invoiceId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      externalId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'paid', 'expired', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      expiredAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'payments',
      underscored: true,
    },
  );

  return Payment;
};
