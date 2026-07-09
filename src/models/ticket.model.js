'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Ticket extends Model {
    static associate(models) {
      Ticket.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
      Ticket.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
    }
  }

  Ticket.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      eventId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      ticketCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      qrCode: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attendeeName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      attendeeEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      attendeePhone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isCheckedIn: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      checkedInAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Ticket',
      tableName: 'tickets',
      underscored: true,
      updatedAt: false, // skema asli hanya punya created_at
    },
  );

  return Ticket;
};
