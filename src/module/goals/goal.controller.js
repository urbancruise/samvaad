const ApiError = require("../../utils/ApiError");
const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");


const {
  createGoalService,
  getMyGoalsService,
  getGoalByIdService,
  updateGoalService,
  deleteGoalService,
  getTodayGoalsService
} = require("./goal.service");

const {
  createGoalSchema,
  updateGoalSchema,
} = require("./goal.validation");

const { canManageGoal } = require("./goal.permission");
const { canManageEmployee } = require("../teamLead/teamLead.permission");

const createGoal = asyncHandler(async (req, res) => {
  const data = createGoalSchema.parse(req.body);
  console.log("this is gooooooooal",req.body);
  
  const targetEmployeeId = data.assignedToId || req.user.id;
  console.log(targetEmployeeId)
  const allowed = await canManageEmployee(req.user.id, targetEmployeeId, req.user.role);

  if (!allowed) { 
    throw new ApiError(403, "You can assign goals only to yourself or your team.");
  }

  const goal = await createGoalService({
  ...data,
  createdById: req.user.id,
  assignedToId: targetEmployeeId,
  creatorRole: req.user.role,
});
  return res.status(201).json(
    new ApiResponse(201, goal, "Goal created successfully")
  );
});

const getMyGoals = asyncHandler(async (req, res) => {
  const goals = await getMyGoalsService(req.user.id, req.query);
  
  return res.status(200).json(
    new ApiResponse(200, goals, "Goals fetched successfully")
  );
});

const getGoalById = asyncHandler(async (req, res) => {
  const goal = await getGoalByIdService(req.params.goalId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, goal, "Goal fetched successfully")
  );
});

const updateGoal = asyncHandler(async (req, res) => {
  const data = updateGoalSchema.parse(req.body);
  const allowed = await canManageGoal(req.user, req.params.goalId);

  if (!allowed) {
    throw new ApiError(403, "You are not allowed to modify this goal");
  }

  const goal = await updateGoalService(
    req.params.goalId,
    req.user.id,
    data,
    req.user.role
  );

  return res.status(200).json(
    new ApiResponse(200, goal, "Goal updated successfully")
  );
});

const deleteGoal = asyncHandler(async (req, res) => {
  const allowed = await canManageGoal(req.user, req.params.goalId);

  if (!allowed) {
    throw new ApiError(403, "You are not allowed to delete this goal");
  }

  await deleteGoalService(req.params.goalId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, null, "Goal deleted successfully")
  );
});

const getTodayGoals = asyncHandler(async (req, res) => {
  const data = await getTodayGoalsService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, data, "Today's work fetched")
  );
});

module.exports = {
  createGoal,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  getTodayGoals,
};