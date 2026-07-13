// src/config/database.js
'use strict';

const config = require('./env');

// Sequelize CLI (migration & seeder) dan runtime aplikasi memakai config yang
// sama — satu sumber kebenaran dari src/config/env.js (SETUP-04), supaya
// kredensial DB tidak terduplikasi di dua tempat berbeda.
const base = {
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  logging: false,
  define: {
    underscored: true, // map atribut camelCase model -> kolom snake_case DB
  },
};

module.exports = {
  development: base,
  test: {
    ...base,
    database: `${config.db.name}_test`,
  },
  production: {
    ...base,
    dialectOptions: {
      // Aktifkan bila provider DB production mewajibkan koneksi SSL
      // ssl: { require: true, rejectUnauthorized: true },
    },
  },
};
