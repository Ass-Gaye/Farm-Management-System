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

const {
  createCorrection,
  getCorrections,
} = require("../controllers/correction.controller");

const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");

const {
  createDailyRecordSchema,
  updateDailyRecordSchema,
  createCorrectionSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

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

// Append-only corrections for immutable (out-of-window) records.
router.post(
  "/:id/corrections",
  validateParams(idParamSchema),
  validate(createCorrectionSchema),
  createCorrection
);

router.get("/:id/corrections", validateParams(idParamSchema), getCorrections);

module.exports = router;