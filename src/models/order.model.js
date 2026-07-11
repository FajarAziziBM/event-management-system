'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Order.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
      Order.hasOne(models.Payment, { foreignKey: 'orderId', as: 'payment' });
      Order.hasMany(models.Ticket, { foreignKey: 'orderId', as: 'tickets' });
    }
  }

  Order.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      orderNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      eventId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      serviceFee: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      paymentStatus: {
        type: DataTypes.ENUM('pending', 'paid', 'expired', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
      },
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
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
      modelName: 'Order',
      tableName: 'orders',
      underscored: true,
    },
  );

  return Order;
};
