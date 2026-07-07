// src/routes/viewRoutes.js

const express = require("express");

const router = express.Router();

// halaman utama
router.get("/", (req, res) => {
  res.render("index", {
    title: "Event Management System",
  });
});

// halaman dashboard
router.get("/dashboard", (req, res) => {
  res.render("dashboard", {
    title: "Dashboard",
  });
});

module.exports = router;
