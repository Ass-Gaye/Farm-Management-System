const express = require("express");
const {
  createSlaughterPlan,
  getSlaughterPlans,
  getSlaughterPlanById,
  updateSlaughterPlan,
  toggleSlaughterPlanComplete,
  deleteSlaughterPlan,
} = require("../controllers/slaughterPlan.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createSlaughterPlanSchema,
  updateSlaughterPlanSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createSlaughterPlanSchema), createSlaughterPlan);
router.get("/", getSlaughterPlans);
router.get("/:id", validateParams(idParamSchema), getSlaughterPlanById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateSlaughterPlanSchema),
  updateSlaughterPlan
);
router.patch("/:id/complete", validateParams(idParamSchema), toggleSlaughterPlanComplete);
router.delete("/:id", validateParams(idParamSchema), deleteSlaughterPlan);

module.exports = router;
