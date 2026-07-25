const ApiError = require("../../utils/ApiError");

const {
  getMyTeamLeads,
  getTeamLeadProfile,
  getTeamLeadGoals,
  getTeamLeadTasks,
  getTeamLeadActivities,
} = require("./manager.repository");

const getMyTeamLeadsService = async (managerId) => {
  return getMyTeamLeads(managerId);
};

const getTeamLeadProfileService = async (managerId, tlId) => {
  const profile = await getTeamLeadProfile(managerId, tlId);
  if (!profile) throw new ApiError(404, "Team lead not found in your team.");
  return profile;
};

const getTeamLeadGoalsService = async (managerId, tlId) => {
  const goals = await getTeamLeadGoals(managerId, tlId);
  if (goals === null) throw new ApiError(404, "Team lead not found in your team.");
  return goals;
};

const getTeamLeadTasksService = async (managerId, tlId) => {
  const tasks = await getTeamLeadTasks(managerId, tlId);
  if (tasks === null) throw new ApiError(404, "Team lead not found in your team.");
  return tasks;
};

const getTeamLeadActivitiesService = async (managerId, tlId) => {
  const activities = await getTeamLeadActivities(managerId, tlId);
  if (activities === null) throw new ApiError(404, "Team lead not found in your team.");
  return activities;
};

module.exports = {
  getMyTeamLeadsService,
  getTeamLeadProfileService,
  getTeamLeadGoalsService,
  getTeamLeadTasksService,
  getTeamLeadActivitiesService,
};