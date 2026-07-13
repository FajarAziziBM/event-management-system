// src/models/event.model.js
'use strict';

const { Model } = require('sequelize');

const slugify = require('../utils/slugify');

module.exports = (sequelize, DataTypes) => {
  class Event extends Model {
    static associate(models) {
      Event.belongsTo(models.User, { foreignKey: 'creatorId', as: 'creator' });
      Event.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
      Event.hasMany(models.Order, { foreignKey: 'eventId', as: 'orders' });
      Event.hasMany(models.Ticket, { foreignKey: 'eventId', as: 'tickets' });
      Event.hasMany(models.EventAttachment, { foreignKey: 'eventId', as: 'attachments' });
    }
  }

  Event.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      creatorId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imagePath: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      eventDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      eventEndDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      maxAttendees: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ticketPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      availableTicket: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'closed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
    },
    {
      sequelize,
      modelName: 'Event',
      tableName: 'events',
      underscored: true,
      indexes: [{ fields: ['status', 'event_date'] }],
      hooks: {
        beforeValidate(event) {
          if (!event.slug && event.title) {
            event.slug = `${slugify(event.title)}-${Date.now().toString(36)}`;
          }
        },
      },
      validate: {
        endAfterStart() {
          if (
            this.eventDate &&
            this.eventEndDate &&
            new Date(this.eventEndDate) <= new Date(this.eventDate)
          ) {
            throw new Error('event_end_date harus setelah event_date');
          }
        },
      },
    },
  );

  return Event;
};
