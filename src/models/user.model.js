// models/user.model.js

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Event, { foreignKey: 'creatorId', as: 'events' });
      User.hasMany(models.Order, { foreignKey: 'userId', as: 'orders' });
    }

    toSafeJSON() {
      const { password: _password, ...safe } = this.toJSON();
      return safe;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('admin', 'organizer', 'customer'),
        allowNull: false,
        defaultValue: 'customer',
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
    },
  );

  return User;
};
