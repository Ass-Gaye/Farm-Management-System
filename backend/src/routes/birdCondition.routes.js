const express = require("express");
const {
  createBirdCondition,
  getBirdConditions,
  getBirdConditionById,
  updateBirdCondition,
  deleteBirdCondition,
} = require("../controllers/birdCondition.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createBirdConditionSchema,
  updateBirdConditionSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createBirdConditionSchema), createBirdCondition);
router.get("/", getBirdConditions);
router.get("/:id", validateParams(idParamSchema), getBirdConditionById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateBirdConditionSchema),
  updateBirdCondition
);
router.delete("/:id", validateParams(idParamSchema), deleteBirdCondition);

module.exports = router;
