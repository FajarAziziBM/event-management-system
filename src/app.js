// src/app.js

const express = require("express");
const env = require("./config/env");
const logger = require("./config/logger");
const requestLogger = require("./middlewares/requestLogger");

const app = express();

app.use(requestLogger);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log(`App running in ${env.app.nodeEnv} mode`);

// routes
// app.use("/api/users", userRoutes);
// app.use("/api/events", eventRoutes);


// Global error handler (harus paling bawah)
app.use((err, req, res, next) => {
  logger.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
