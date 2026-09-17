const express = require("express");
const { register, login, getMe } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../middleware/validation.schemas");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", authenticate, getMe);

module.exports = router;
