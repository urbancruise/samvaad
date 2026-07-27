const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const { isSelfOrSubordinate } = require("../../utils/hierarchy.service");

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

/**
 * Generic "view someone else's performance" endpoints — used by every
 * profile module (TL viewing an Employee, Manager viewing a TL, HOD
 * viewing a Manager, Admin viewing anyone). Gated by isSelfOrSubordinate,
 * the same hierarchy check every other module already relies on —
 * SUPER_ADMIN bypasses it entirely, everyone else can only view
 * themselves or someone in their subordinate chain.
 */
const ensureCanViewUser = async (req) => {
  const allowed = await isSelfOrSubordinate(req.user.id, req.params.userId, req.user.role);
  if (!allowed) {
    throw new ApiError(403, "You are not allowed to view this user's performance.");
  }
};

const getUserPerformanceDashboard = asyncHandler(async (req, res) => {
  await ensureCanViewUser(req);
  const dashboard = await getPerformanceDashboardService(Number(req.params.userId));

  return res.status(200).json(
    new ApiResponse(200, dashboard, "Performance dashboard fetched successfully")
  );
});

const getUserAchievements = asyncHandler(async (req, res) => {
  await ensureCanViewUser(req);
  const data = await getAchievementsService(Number(req.params.userId));

  return res.status(200).json(
    new ApiResponse(200, data, "Achievements fetched successfully")
  );
});

const getUserPerformanceAnalytics = asyncHandler(async (req, res) => {
  await ensureCanViewUser(req);
  const data = await getPerformanceAnalyticsService(
    Number(req.params.userId),
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
  getUserPerformanceDashboard,
  getUserAchievements,
  getUserPerformanceAnalytics,
};