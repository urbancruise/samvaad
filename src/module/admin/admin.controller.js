const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const {
  getAllUsersService,
  getUserProfileService,
  getUserGoalsService,
  getUserTasksService,
  getUserActivitiesService,
  getDepartmentsService
} = require("./admin.service");

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await getAllUsersService(req.query);
  return res.status(200).json(
    new ApiResponse(200, users, "Users fetched successfully")
  );
});
const getDepartments = asyncHandler(async (req, res) => {
  const data = await getDepartmentsService();
  return res.status(200).json(new ApiResponse(200, data, "Departments fetched successfully"));
});

const getUserProfile = asyncHandler(async (req, res) => {
  const profile = await getUserProfileService(req.params.userId);
  return res.status(200).json(
    new ApiResponse(200, profile, "User profile fetched successfully")
  );
});

const getUserGoals = asyncHandler(async (req, res) => {
  const goals = await getUserGoalsService(req.params.userId);
  return res.status(200).json(
    new ApiResponse(200, goals, "User goals fetched successfully")
  );
});

const getUserTasks = asyncHandler(async (req, res) => {
  const tasks = await getUserTasksService(req.params.userId);
  return res.status(200).json(
    new ApiResponse(200, tasks, "User tasks fetched successfully")
  );
});

const getUserActivities = asyncHandler(async (req, res) => {
  const activities = await getUserActivitiesService(req.params.userId);
  return res.status(200).json(
    new ApiResponse(200, activities, "User activities fetched successfully")
  );
});

module.exports = {
  getAllUsers,
  getDepartments,
  getUserProfile,
  getUserGoals,
  getUserTasks,
  getUserActivities,
};