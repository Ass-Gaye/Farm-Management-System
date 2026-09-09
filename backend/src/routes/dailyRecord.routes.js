const express = require("express");

const {
  createDailyRecord,
  getDailyRecords,
} = require("../controllers/dailyRecord.controller");

// const router = express.Router();
const router = express.Router({ mergeParams: true });

router.post("/", createDailyRecord);
router.get("/", getDailyRecords);

module.exports = router;