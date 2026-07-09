'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EventAttachment extends Model {
    static associate(models) {
      EventAttachment.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
    }
  }

  EventAttachment.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      eventId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      filePath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'EventAttachment',
      tableName: 'event_attachments',
      underscored: true,
      updatedAt: false, // skema asli hanya punya created_at
    },
  );

  return EventAttachment;
};
