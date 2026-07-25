const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const {
  getMyManagersService,
  getManagerProfileService,
  getManagerGoalsService,
  getManagerTasksService,
  getManagerActivitiesService,
} = require("./hod.service");

const getMyManagers = asyncHandler(async (req, res) => {
  const managers = await getMyManagersService(req.user.id);
  return res.status(200).json(
    new ApiResponse(200, managers, "Managers fetched successfully")
  );
});

const getManagerProfile = asyncHandler(async (req, res) => {
  const profile = await getManagerProfileService(req.user.id, req.params.managerId);
  return res.status(200).json(
    new ApiResponse(200, profile, "Manager profile fetched successfully")
  );
});

const getManagerGoals = asyncHandler(async (req, res) => {
  const goals = await getManagerGoalsService(req.user.id, req.params.managerId);
  return res.status(200).json(
    new ApiResponse(200, goals, "Manager goals fetched successfully")
  );
});

const getManagerTasks = asyncHandler(async (req, res) => {
  const tasks = await getManagerTasksService(req.user.id, req.params.managerId);
  return res.status(200).json(
    new ApiResponse(200, tasks, "Manager tasks fetched successfully")
  );
});

const getManagerActivities = asyncHandler(async (req, res) => {
  const activities = await getManagerActivitiesService(req.user.id, req.params.managerId);
  return res.status(200).json(
    new ApiResponse(200, activities, "Manager activities fetched successfully")
  );
});

module.exports = {
  getMyManagers,
  getManagerProfile,
  getManagerGoals,
  getManagerTasks,
  getManagerActivities,
};