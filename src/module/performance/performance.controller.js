const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const {
  getAchievementsService,
  getPerformanceDashboardService,
  getPerformanceAnalyticsService,
} = require("./performance.service");

const getPerformanceDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getPerformanceDashboardService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, dashboard, "Performance dashboard fetched successfully")
  );
});

const getAchievements = asyncHandler(async (req, res) => {
  const data = await getAchievementsService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Achievements fetched successfully")
  );
});

const getPerformanceAnalytics = asyncHandler(async (req, res) => {
  const data = await getPerformanceAnalyticsService(
    req.user.id,
    req.query.period || "MONTHLY"
  );

  return res.status(200).json(
    new ApiResponse(200, data, "Performance analytics fetched successfully")
  );
});

module.exports = {
  getPerformanceDashboard,
  getAchievements,
  getPerformanceAnalytics,
};