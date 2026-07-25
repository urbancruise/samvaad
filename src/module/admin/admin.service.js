const ApiError = require("../../utils/ApiError");

const {
  getAllUsers,
  getUserProfile,
  getUserGoals,
  getUserTasks,
  getUserActivities,
} = require("./admin.repository");

const getAllUsersService = async (query) => {
  return getAllUsers(query);
};

const getUserProfileService = async (userId) => {
  const profile = await getUserProfile(userId);
  if (!profile) throw new ApiError(404, "User not found.");
  return profile;
};

const getUserGoalsService = async (userId) => {
  const goals = await getUserGoals(userId);
  if (goals === null) throw new ApiError(404, "User not found.");
  return goals;
};

const getUserTasksService = async (userId) => {
  const tasks = await getUserTasks(userId);
  if (tasks === null) throw new ApiError(404, "User not found.");
  return tasks;
};

const getUserActivitiesService = async (userId) => {
  const activities = await getUserActivities(userId);
  if (activities === null) throw new ApiError(404, "User not found.");
  return activities;
};

module.exports = {
  getAllUsersService,
  getUserProfileService,
  getUserGoalsService,
  getUserTasksService,
  getUserActivitiesService,
};