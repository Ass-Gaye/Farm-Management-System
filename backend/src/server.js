const express = require("express");
const cors = require("cors");
require("dotenv").config();

const houseRoutes = require("./routes/house.routes");
const dailyRecordRoutes = require("./routes/dailyRecord.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Poultry Management API is running",
  });
});

app.use("/api/houses", houseRoutes);
app.use("/api/houses/:houseId/records", dailyRecordRoutes);
app.use("/api/houses/:houseId/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});