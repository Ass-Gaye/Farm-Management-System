/**
 * Application entry point.
 *
 * Initializes Express, registers global middleware and API routes, installs
 * the final error handler, and starts the HTTP server.
 */
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const errorMiddleware = require("./middleware/error.middleware");

const authRoutes = require("./routes/auth.routes");
const houseRoutes = require("./routes/house.routes");
const dailyRecordRoutes = require("./routes/dailyRecord.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const breedRoutes = require("./routes/breed.routes");
const birdConditionRoutes = require("./routes/birdCondition.routes");
const slaughterPlanRoutes = require("./routes/slaughterPlan.routes");

const createApp = () => {
  const app = express();
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
  app.use(express.json());

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