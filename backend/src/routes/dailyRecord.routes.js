/**
 * Daily-record API routes.
 *
 * Create and update operations validate request bodies before their
 * controllers run; read and delete operations use controller handlers.
 */
const express = require("express");

const {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
} = require("../controllers/dailyRecord.controller");

const { validate, validateParams } = require("../middleware/validate");

const {
  createDailyRecordSchema,
  updateDailyRecordSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.post(
  "/",
  validate(createDailyRecordSchema),
  createDailyRecord
);

router.get("/", getDailyRecords);

router.get("/:id", validateParams(idParamSchema), getDailyRecordById);

router.put(
  "/:id",
  validate(updateDailyRecordSchema),
  validateParams(idParamSchema),
  updateDailyRecord
);

router.delete("/:id", validateParams(idParamSchema), deleteDailyRecord);

module.exports = router;