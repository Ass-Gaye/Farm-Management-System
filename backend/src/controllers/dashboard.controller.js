const { getHouseDashboard } = require("../services/dashboard.service");

/**
 * Returns dashboard statistics for a house owned by the authenticated user.
 *
 * @param {import("express").Request} req Request containing houseId and req.user
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const getDashboard = async (req, res, next) => {
  try {
    const { houseId } = req.params;

    const dashboard = await getHouseDashboard(houseId, req.user.id);

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