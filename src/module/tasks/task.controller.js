const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const { updateTaskStatusService } = require("./task.service");
const { canUpdateTaskStatus } = require("./task.permission");

const {
  createTaskService,
  getMyTasksService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  getTaskDashboardService,
  getCalendarTasksService,
  getTaskTimelineService,
} = require("./task.service");

const { createTaskSchema, updateTaskSchema } = require("./task.validation");
const { canManageTask } = require("./task.permission");
const { canManageEmployee } = require("../teamLead/teamLead.permission");

const createTask = asyncHandler(async (req, res) => {
  const data = createTaskSchema.parse(req.body);
   console.log("this is gooooooooal",req.body);
  const targetUserId = data.assignedToId || req.user.id;
  console.log(targetUserId)

  const allowed = await canManageEmployee(req.user.id, targetUserId, req.user.role);
  if (!allowed) {
    throw new ApiError(403, "You can assign tasks only to yourself or your team.");
  }

  const task = await createTaskService({
    ...data,
    createdById: req.user.id,
    assignedToId: targetUserId,
    creatorRole: req.user.role,
  });

  return res.status(201).json(
    new ApiResponse(201, task, "Task created successfully")
  );
});

const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await getMyTasksService(req.user.id, req.query);

  return res.status(200).json(
    new ApiResponse(200, tasks, "Tasks fetched successfully")
  );
});

const getTaskById = asyncHandler(async (req, res) => {
  const task = await getTaskByIdService(req.params.taskId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, task, "Task fetched successfully")
  );
});

const updateTask = asyncHandler(async (req, res) => {
  const data = updateTaskSchema.parse(req.body);
  
  const allowed = await canManageTask(req.user, req.params.taskId);
  if (!allowed) {
    throw new ApiError(403, "You are not allowed to modify this task");
  }

  const task = await updateTaskService(req.params.taskId, req.user.id, data, req.user.role);

  return res.status(200).json(
    new ApiResponse(200, task, "Task updated successfully")
  );
});

const deleteTask = asyncHandler(async (req, res) => {
  const allowed = await canManageTask(req.user, req.params.taskId);
  if (!allowed) {
    throw new ApiError(403, "You are not allowed to delete this task");
  }

  await deleteTaskService(req.params.taskId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, null, "Task deleted successfully")
  );
});

const getTaskDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getTaskDashboardService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, dashboard, "Dashboard fetched successfully")
  );
});

const getCalendarTasks = asyncHandler(async (req, res) => {
  const tasks = await getCalendarTasksService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, tasks, "Calendar data fetched successfully")
  );
});

const getTaskTimeline = asyncHandler(async (req, res) => {
  const timeline = await getTaskTimelineService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, timeline, "Timeline fetched successfully")
  );
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const allowed = await canUpdateTaskStatus(req.user, req.params.taskId);
  if (!allowed) {
    throw new ApiError(403, "Only the assignee can update this task's status.");
  }

  const task = await updateTaskStatusService(req.params.taskId, req.user.id, req.body);

  return res.status(200).json(
    new ApiResponse(200, task, "Task status updated successfully")
  );
});

module.exports = {
  createTask,
  getMyTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskDashboard,
  getCalendarTasks,
  getTaskTimeline,
  updateTaskStatus
};