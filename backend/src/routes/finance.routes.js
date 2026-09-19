const express = require("express");
const {
  getFinancialSummary,
  getFinancialTransactions,
  getFinancialReports,
} = require("../controllers/finance.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/summary", getFinancialSummary);
router.get("/transactions", getFinancialTransactions);
router.get("/reports", getFinancialReports);

module.exports = router;
