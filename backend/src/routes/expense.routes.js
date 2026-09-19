const express = require("express");
const {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} = require("../controllers/finance.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createExpenseSchema,
  updateExpenseSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createExpenseSchema), createExpense);
router.get("/", getExpenses);
router.get("/:id", validateParams(idParamSchema), getExpenseById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateExpenseSchema),
  updateExpense
);
router.delete("/:id", validateParams(idParamSchema), deleteExpense);

module.exports = router;
