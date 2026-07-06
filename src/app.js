const express = require('express');
const env = require('./config/env');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log(`App running in ${env.app.nodeEnv} mode`);

module.exports = app;
