const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");

const {
  getDepartmentsService,
  getFieldConfigService,
  getEmployeeRatingService,
  getTeamRatingService,
  upsertSelfRatingService,
  upsertSeniorRatingService,
} = require("./rating.service");

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getDepartments = asyncHandler(async (req, res) => {
  const departments = await getDepartmentsService();
  return res.status(200).json(new ApiResponse(200, departments, "Departments fetched successfully"));
});

const getFieldConfig = asyncHandler(async (req, res) => {
  const config = await getFieldConfigService(req.query.departmentId);
  return res.status(200).json(new ApiResponse(200, config, "Field config fetched successfully"));
});

const getEmployeeRating = asyncHandler(async (req, res) => {
  const period = req.query.period || currentPeriod();
  const rating = await getEmployeeRatingService(req.user.id, req.user.role, req.params.employeeId, period);
  return res.status(200).json(new ApiResponse(200, rating, "Rating fetched successfully"));
});

const getMyRating = asyncHandler(async (req, res) => {
  const period = req.query.period || currentPeriod();
  const rating = await getEmployeeRatingService(req.user.id, req.user.role, req.user.id, period);
  return res.status(200).json(new ApiResponse(200, rating, "Rating fetched successfully"));
});

const getTeamRating = asyncHandler(async (req, res) => {
  const period = req.query.period || currentPeriod();
  const { department } = req.query;
  const team = await getTeamRatingService(req.user.id, req.user.role, { department, period });
  return res.status(200).json(new ApiResponse(200, team, "Team ratings fetched successfully"));
});

const submitSelfRating = asyncHandler(async (req, res) => {
  const period = req.body.period || currentPeriod();
  const row = await upsertSelfRatingService(req.user.id, req.params.employeeId, period, req.body);
  return res.status(200).json(new ApiResponse(200, row, "Self rating saved successfully"));
});

const submitSeniorRating = asyncHandler(async (req, res) => {
  const period = req.body.period || currentPeriod();
  const row = await upsertSeniorRatingService(req.user.id, req.user.role, req.params.employeeId, period, req.body);
  return res.status(200).json(new ApiResponse(200, row, "Senior rating saved successfully"));
});

module.exports = {
  getDepartments,
  getFieldConfig,
  getEmployeeRating,
  getMyRating,
  getTeamRating,
  submitSelfRating,
  submitSeniorRating,
};