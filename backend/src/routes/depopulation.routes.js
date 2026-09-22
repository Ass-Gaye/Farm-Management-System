const express = require("express");
const {
  createDepopulationEvent,
  getDepopulationEvents,
  getDepopulationEventById,
  updateDepopulationEvent,
  deleteDepopulationEvent,
} = require("../controllers/depopulation.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  idParamSchema,
  createDepopulationEventSchema,
  updateDepopulationEventSchema,
} = require("../middleware/validation.schemas");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// POST /api/depopulation-events or /api/flocks/:flockId/depopulation-events
router.post(
  "/",
  validate(createDepopulationEventSchema),
  createDepopulationEvent
);

// GET /api/depopulation-events or /api/flocks/:flockId/depopulation-events
router.get("/", getDepopulationEvents);

// GET /api/depopulation-events/:id
router.get(
  "/:id",
  validateParams(idParamSchema),
  getDepopulationEventById
);

// PUT /api/depopulation-events/:id
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateDepopulationEventSchema),
  updateDepopulationEvent
);

// DELETE /api/depopulation-events/:id
router.delete(
  "/:id",
  validateParams(idParamSchema),
  deleteDepopulationEvent
);

module.exports = router;
