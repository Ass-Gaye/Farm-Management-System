const express = require("express");
const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplier.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createSupplierSchema,
  updateSupplierSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createSupplierSchema), createSupplier);
router.get("/", getSuppliers);
router.get("/:id", validateParams(idParamSchema), getSupplierById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateSupplierSchema),
  updateSupplier
);
router.delete("/:id", validateParams(idParamSchema), deleteSupplier);

module.exports = router;
