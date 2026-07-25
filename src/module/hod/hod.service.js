const ApiError = require("../../utils/ApiError");

const {
  getMyManagers,
  getManagerProfile,
  getManagerGoals,
  getManagerTasks,
  getManagerActivities,
} = require("./hod.repository");

const getMyManagersService = async (hodId) => {
  return getMyManagers(hodId);
};

const getManagerProfileService = async (hodId, managerId) => {
  const profile = await getManagerProfile(hodId, managerId);
  if (!profile) throw new ApiError(404, "Manager not found in your team.");
  return profile;
};

const getManagerGoalsService = async (hodId, managerId) => {
  const goals = await getManagerGoals(hodId, managerId);
  if (goals === null) throw new ApiError(404, "Manager not found in your team.");
  return goals;
};

const getManagerTasksService = async (hodId, managerId) => {
  const tasks = await getManagerTasks(hodId, managerId);
  if (tasks === null) throw new ApiError(404, "Manager not found in your team.");
  return tasks;
};

const getManagerActivitiesService = async (hodId, managerId) => {
  const activities = await getManagerActivities(hodId, managerId);
  if (activities === null) throw new ApiError(404, "Manager not found in your team.");
  return activities;
};

module.exports = {
  getMyManagersService,
  getManagerProfileService,
  getManagerGoalsService,
  getManagerTasksService,
  getManagerActivitiesService,
};