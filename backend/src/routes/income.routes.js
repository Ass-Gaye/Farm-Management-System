const express = require("express");
const {
  createIncome,
  getIncome,
  getIncomeById,
  updateIncome,
  deleteIncome,
} = require("../controllers/finance.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createIncomeSchema,
  updateIncomeSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createIncomeSchema), createIncome);
router.get("/", getIncome);
router.get("/:id", validateParams(idParamSchema), getIncomeById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateIncomeSchema),
  updateIncome
);
router.delete("/:id", validateParams(idParamSchema), deleteIncome);

module.exports = router;
