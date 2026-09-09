const express = require("express");

const { getDashboard } = require("../controllers/dashboard.controller");

const router = express.Router({ mergeParams: true });

router.get("/", getDashboard);

module.exports = router;