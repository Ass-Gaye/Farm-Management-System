const express = require("express");

const {
  createHouse,
  getHouses,
  getHouseById,
} = require("../controllers/house.controller");

const router = express.Router();

router.post("/", createHouse);
router.get("/", getHouses);
router.get("/:id", getHouseById);

module.exports = router;