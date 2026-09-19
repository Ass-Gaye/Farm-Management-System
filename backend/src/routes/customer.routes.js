const express = require("express");
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customer.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createCustomerSchema,
  updateCustomerSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createCustomerSchema), createCustomer);
router.get("/", getCustomers);
router.get("/:id", validateParams(idParamSchema), getCustomerById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateCustomerSchema),
  updateCustomer
);
router.delete("/:id", validateParams(idParamSchema), deleteCustomer);

module.exports = router;
