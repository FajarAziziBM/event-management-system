// src/server.js

'use strict';

const app = require('./app');
const logger = require('./config/logger');
const config = require('./config/env');
const app = require("./app");
const logger = require("./config/logger");

const PORT = config.app.port;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
