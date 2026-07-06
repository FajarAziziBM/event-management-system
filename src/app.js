const express = require('express');
const env = require('./config/env');

const app = express();

app.use(requestLogger);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

logger.info(`Server running on port ${PORT}`);
logger.error(error);

console.log(`App running in ${env.app.nodeEnv} mode`);

module.exports = app;
