/**
 * Poultry-house API routes.
 *
 * Routes keep HTTP method/path wiring and request-body validation separate
 * from the controller operations.
 */
const express = require("express");

const {
  createHouse,
  getHouses,
  getHouseById,
  updateHouse,
  deleteHouse,
} = require("../controllers/house.controller");

const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");

const {
  createHouseSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  validate(createHouseSchema),
  createHouse
);

router.get("/", getHouses);

router.get("/:id", validateParams(idParamSchema), getHouseById);

router.put(
  "/:id",
  validate(createHouseSchema),
  validateParams(idParamSchema),
  updateHouse
);

router.delete("/:id", validateParams(idParamSchema), deleteHouse);

module.exports = router;