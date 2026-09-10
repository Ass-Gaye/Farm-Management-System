const express = require("express");

const {
  createHouse,
  getHouses,
  getHouseById,
  updateHouse,
  deleteHouse,
} = require("../controllers/house.controller");

const validate = require("../middleware/validate");

const {
  createHouseSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.post(
  "/",
  validate(createHouseSchema),
  createHouse
);

router.get("/", getHouses);

router.get("/:id", getHouseById);

router.put(
  "/:id",
  validate(createHouseSchema),
  updateHouse
);

router.delete("/:id", deleteHouse);

module.exports = router;