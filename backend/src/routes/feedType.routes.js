const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createFeedTypeSchema,
  updateFeedTypeSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");
const {
  getFeedTypes,
  getFeedTypeById,
  createFeedType,
  updateFeedType,
  deleteFeedType,
} = require("../controllers/feedType.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", getFeedTypes);
router.get("/:id", validateParams(idParamSchema), getFeedTypeById);
router.post("/", validate(createFeedTypeSchema), createFeedType);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateFeedTypeSchema),
  updateFeedType
);
router.delete("/:id", validateParams(idParamSchema), deleteFeedType);

module.exports = router;
