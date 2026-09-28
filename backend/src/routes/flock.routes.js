const express = require("express");
const {
  createFlock,
  getFlocks,
  getFlockById,
  getFlockTrends,
  closeoutFlock,
  updateFlock,
  deleteFlock,
} = require("../controllers/flock.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createFlockSchema,
  updateFlockSchema,
  flockCloseoutSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createFlockSchema), createFlock);
router.get("/", getFlocks);
router.get("/:id/trends", validateParams(idParamSchema), getFlockTrends);
router.post(
  "/:id/closeout",
  validateParams(idParamSchema),
  validate(flockCloseoutSchema),
  closeoutFlock
);
router.get("/:id", validateParams(idParamSchema), getFlockById);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateFlockSchema),
  updateFlock
);
router.delete("/:id", validateParams(idParamSchema), deleteFlock);

module.exports = router;
