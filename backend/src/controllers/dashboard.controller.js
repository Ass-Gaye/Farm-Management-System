const { getHouseDashboard } = require("../services/dashboard.service");

const getDashboard = async (req, res, next) => {

  try {
    
    const { houseId } = req.params;

    const dashboard = await getHouseDashboard(houseId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });

  } catch (error) {
    next(error);
  }

};

module.exports = {
  getDashboard,
};