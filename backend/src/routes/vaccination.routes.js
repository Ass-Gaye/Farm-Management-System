const express = require("express");
const {
  createVaccination,
  applyVaccinationTemplate,
  getVaccinations,
  updateVaccination,
  deleteVaccination,
} = require("../controllers/vaccination.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, validateParams } = require("../middleware/validate");
const {
  createVaccinationSchema,
  updateVaccinationSchema,
  idParamSchema,
} = require("../middleware/validation.schemas");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createVaccinationSchema), createVaccination);
router.post("/auto-schedule", applyVaccinationTemplate);
router.get("/", getVaccinations);
router.put(
  "/:id",
  validateParams(idParamSchema),
  validate(updateVaccinationSchema),
  updateVaccination
);
router.delete("/:id", validateParams(idParamSchema), deleteVaccination);

module.exports = router;
