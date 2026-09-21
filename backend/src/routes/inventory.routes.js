const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate");
const { stockAdjustmentSchema } = require("../middleware/validation.schemas");
const {
  getInventorySummary,
  getInventoryMovements,
  recordStockAdjustment,
} = require("../controllers/inventory.controller");

const router = express.Router();

router.use(authenticate);

router.get("/summary", getInventorySummary);
router.get("/movements", getInventoryMovements);
router.post("/adjust", validate(stockAdjustmentSchema), recordStockAdjustment);

module.exports = router;
