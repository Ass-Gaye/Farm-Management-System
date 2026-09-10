/**
 * House dashboard route.
 *
 * The controller delegates aggregate calculations to the dashboard service.
 */
const express = require("express");

const { getDashboard } = require("../controllers/dashboard.controller");
const { validateParams } = require("../middleware/validate");
const { houseIdParamSchema } = require("../middleware/validation.schemas");

const router = express.Router({ mergeParams: true });

router.get("/", validateParams(houseIdParamSchema), getDashboard);

module.exports = router;