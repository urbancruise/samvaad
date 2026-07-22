const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { getEmployeeDashboardService } = require("./dashboard.service");

const getEmployeeDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getEmployeeDashboardService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, dashboard, "Dashboard fetched successfully")
  );
});

module.exports = {
  getEmployeeDashboard,
};