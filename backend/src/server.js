/**
 * Application entry point.
 *
 * Initializes Express, registers global middleware and API routes, installs
 * the final error handler, and starts the HTTP server.
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const errorMiddleware = require("./middleware/error.middleware");

const authRoutes = require("./routes/auth.routes");
const houseRoutes = require("./routes/house.routes");
const dailyRecordRoutes = require("./routes/dailyRecord.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const breedRoutes = require("./routes/breed.routes");
const birdConditionRoutes = require("./routes/birdCondition.routes");
const slaughterPlanRoutes = require("./routes/slaughterPlan.routes");
const expenseRoutes = require("./routes/expense.routes");
const incomeRoutes = require("./routes/income.routes");
const customerRoutes = require("./routes/customer.routes");
const supplierRoutes = require("./routes/supplier.routes");
const financeRoutes = require("./routes/finance.routes");
const feedTypeRoutes = require("./routes/feedType.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const flockRoutes = require("./routes/flock.routes");
const vaccinationRoutes = require("./routes/vaccination.routes");
const { authenticate } = require("./middleware/auth.middleware");
const {
  getFinancialSummary,
  getFinancialTransactions,
  getFinancialReports,
} = require("./controllers/finance.controller");

const createApp = () => {
  const app = express();
  app.use(helmet());
  const allowedOrigins = process.env.CORS_ORIGIN
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors(
      allowedOrigins?.length
        ? {
            origin: (requestOrigin, callback) => {
              callback(
                null,
                !requestOrigin || allowedOrigins.includes(requestOrigin)
              );
            },
          }
        : process.env.NODE_ENV === "production"
          ? { origin: false }
          : undefined
    )
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      message: "Poultry Management API is running",
    });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/houses", houseRoutes);
  app.use("/api/daily-records", dailyRecordRoutes);
  app.use("/api/houses/:houseId/dashboard", dashboardRoutes);
  app.use("/api/breeds", breedRoutes);
  app.use("/api/bird-conditions", birdConditionRoutes);
  app.use("/api/slaughter-plans", slaughterPlanRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/income", incomeRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/suppliers", supplierRoutes);
  app.use("/api/finances", financeRoutes);
  app.use("/api/feed-types", feedTypeRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/flocks", flockRoutes);
  app.use("/api/vaccinations", vaccinationRoutes);

  // Financial route aliases
  app.get("/api/financial-summary", authenticate, getFinancialSummary);
  app.get("/api/financial-transactions", authenticate, getFinancialTransactions);
  app.get("/api/financial-reports", authenticate, getFinancialReports);

  app.use(errorMiddleware);

  return app;
};

const app = createApp();

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, createApp };