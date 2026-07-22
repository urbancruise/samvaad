const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const {
  getTeamMembersService,
  getTeamMemberService,
  getTeamPerformanceService,
  getTeamWorkloadService,
  getAssignableEmployeesService,
  getMyTeamService
} = require("./teamLead.service");

const getTeamMembers = asyncHandler(async (req, res) => {
  const data = await getTeamMembersService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Team members fetched successfully.")
  );
});

const getTeamMember = asyncHandler(async (req, res) => {
  const data = await getTeamMemberService(req.user.id, req.params.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Team member fetched successfully.")
  );
});

const getTeamPerformance = asyncHandler(async (req, res) => {
  const data = await getTeamPerformanceService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Team performance fetched successfully.")
  );
});

const getTeamWorkload = asyncHandler(async (req, res) => {
  const data = await getTeamWorkloadService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Team workload fetched successfully.")
  );
});

const getAssignableEmployees = asyncHandler(async (req, res) => {
  const data = await getAssignableEmployeesService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Assignable employees fetched successfully.")
  );
});

const getMyTeam = asyncHandler(async (req, res) => {
  const data = await getMyTeamService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Team fetched successfully.")
  );
});

module.exports = {
  getTeamMembers,
  getTeamMember,
  getTeamPerformance,
  getTeamWorkload,
  getAssignableEmployees,
  getMyTeam
};