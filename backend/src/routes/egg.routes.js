const express = require("express");
const {
  getEggInventory,
  getEggMovements,
  recordEggAdjustment,
  createEggSale,
  getEggSales,
  getEggSaleById,
  updateEggSale,
  deleteEggSale,
} = require("../controllers/egg.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  idParamSchema,
  createEggSaleSchema,
  updateEggSaleSchema,
  eggAdjustmentSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

// Egg inventory (pieces)
router.get("/inventory", getEggInventory);
router.get("/movements", getEggMovements);
router.post("/adjust", validate(eggAdjustmentSchema), recordEggAdjustment);

// Egg sales
router.get("/sales", getEggSales);
router.post("/sales", validate(createEggSaleSchema), createEggSale);
router.get("/sales/:id", validateParams(idParamSchema), getEggSaleById);
router.put(
  "/sales/:id",
  validateParams(idParamSchema),
  validate(updateEggSaleSchema),
  updateEggSale
);
router.delete("/sales/:id", validateParams(idParamSchema), deleteEggSale);

module.exports = router;
