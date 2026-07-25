const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const {
  getAllUsersService,
  getUserProfileService,
  getUserGoalsService,
  getUserTasksService,
  getUserActivitiesService,
} = require("./admin.service");

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await getAllUsersService(req.query);
  return res.status(200).json(
    new ApiResponse(200, users, "Users fetched successfully")
  );
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
  getUserProfile,
  getUserGoals,
  getUserTasks,
  getUserActivities,
};