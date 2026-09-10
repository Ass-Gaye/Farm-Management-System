const express = require("express");

const {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
} = require("../controllers/dailyRecord.controller");

const validate = require("../middleware/validate");

const {
  createDailyRecordSchema,
  updateDailyRecordSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.post(
  "/",
  validate(createDailyRecordSchema),
  createDailyRecord
);

router.get("/", getDailyRecords);

router.get("/:id", getDailyRecordById);

router.put(
  "/:id",
  validate(updateDailyRecordSchema),
  updateDailyRecord
);

router.delete("/:id", deleteDailyRecord);

module.exports = router;