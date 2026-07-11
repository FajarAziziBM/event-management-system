// models/index.js

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');

const env = process.env.NODE_ENV || 'development';
const dbConfig = require('../config/database')[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

const db = {};

fs.readdirSync(__dirname)
  .filter((file) => file.endsWith('.model.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
