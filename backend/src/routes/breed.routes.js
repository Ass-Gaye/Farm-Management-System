const express = require("express");
const {
  createBreed,
  getBreeds,
  getBreedById,
  updateBreed,
  deleteBreed,
} = require("../controllers/breed.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createBreedSchema,
  updateBreedSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createBreedSchema), createBreed);
router.get("/", getBreeds);
router.get("/:id", validateParams(idParamSchema), getBreedById);
router.put("/:id", validateParams(idParamSchema), validate(updateBreedSchema), updateBreed);
router.delete("/:id", validateParams(idParamSchema), deleteBreed);

module.exports = router;
