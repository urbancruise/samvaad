const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const {
  getMyTeamLeadsService,
  getTeamLeadProfileService,
  getTeamLeadGoalsService,
  getTeamLeadTasksService,
  getTeamLeadActivitiesService,
} = require("./manager.service");

const getMyTeamLeads = asyncHandler(async (req, res) => {
  const teamLeads = await getMyTeamLeadsService(req.user.id);
  return res.status(200).json(
    new ApiResponse(200, teamLeads, "Team leads fetched successfully")
  );
});

const getTeamLeadProfile = asyncHandler(async (req, res) => {
  const profile = await getTeamLeadProfileService(req.user.id, req.params.tlId);
  return res.status(200).json(
    new ApiResponse(200, profile, "Team lead profile fetched successfully")
  );
});

const getTeamLeadGoals = asyncHandler(async (req, res) => {
  const goals = await getTeamLeadGoalsService(req.user.id, req.params.tlId);
  return res.status(200).json(
    new ApiResponse(200, goals, "Team lead goals fetched successfully")
  );
});

const getTeamLeadTasks = asyncHandler(async (req, res) => {
  const tasks = await getTeamLeadTasksService(req.user.id, req.params.tlId);
  return res.status(200).json(
    new ApiResponse(200, tasks, "Team lead tasks fetched successfully")
  );
});

const getTeamLeadActivities = asyncHandler(async (req, res) => {
  const activities = await getTeamLeadActivitiesService(req.user.id, req.params.tlId);
  return res.status(200).json(
    new ApiResponse(200, activities, "Team lead activities fetched successfully")
  );
});

module.exports = {
  getMyTeamLeads,
  getTeamLeadProfile,
  getTeamLeadGoals,
  getTeamLeadTasks,
  getTeamLeadActivities,
};