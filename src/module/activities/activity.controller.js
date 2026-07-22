const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");

const {
  createActivityService,
  getMyActivitiesService,
  getActivityByIdService,
  updateActivityService,
  deleteActivityService,
  getActivityDashboardService,
  getActivityCalendarService,
  getActivityTimelineService,
} = require("./activity.service");

const {
  createActivitySchema,
  updateActivitySchema,
} = require("./activity.validation");
const { updateActivityStatusService } = require("./activity.service");
const { canUpdateActivityStatus } = require("./activity.permission");

const { canManageActivity } = require('./activity.permission');
const { canManageEmployee } = require("../teamLead/teamLead.permission");

const createActivity = asyncHandler(async (req, res) => {
  let data;
  try {
    data = createActivitySchema.parse(req.body);
  } catch (error) {
    throw new ApiError(400, error.message || "Validation failed");
  }

  // const allowed = await canManageEmployee(req.user.id, req.body.assignedToId);

  // if (!allowed) {
  //   throw new ApiError(
  //     403,
  //     "You can assign activities only to yourself or your team."
  //   );
  // }

  const activity = await createActivityService({
    ...data,
    createdById: req.user.id,
    assignedToId: data.assignedToId || req.user.id,
    creatorRole: req.user.role,
  });

  return res.status(201).json(
    new ApiResponse(201, activity, "Activity created successfully")
  );
});

const getMyActivities = asyncHandler(async (req, res) => {
  const activities = await getMyActivitiesService(req.user.id, req.query);

  return res.status(200).json(
    new ApiResponse(200, activities, "Activities fetched successfully")
  );
});

const getActivityById = asyncHandler(async (req, res) => {
  const activity = await getActivityByIdService(req.params.activityId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, activity, "Activity fetched successfully")
  );
});

const updateActivity = asyncHandler(async (req, res) => {
  let data;
  try {
    data = updateActivitySchema.parse(req.body);
  } catch (error) {
    throw new ApiError(400, error.message || "Validation failed");
  }

  const allowed = await canManageActivity(req.user, req.params.activityId);

  if (!allowed) {
    throw new ApiError(403, "You are not allowed to modify this task");
  }

  const activity = await updateActivityService(
    req.params.activityId,
    req.user.id,
    data,
    req.user.role
  );

  return res.status(200).json(
    new ApiResponse(200, activity, "Activity updated successfully")
  );
});

const deleteActivity = asyncHandler(async (req, res) => {
  const allowed = await canManageActivity(req.user, req.params.activityId);

  if (!allowed) {
    throw new ApiError(403, "You are not allowed to delete this task");
  }

  await deleteActivityService(req.params.activityId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, null, "Activity deleted successfully")
  );
});

const getActivityDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getActivityDashboardService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, dashboard, "Activity dashboard fetched successfully")
  );
});

const getActivityCalendar = asyncHandler(async (req, res) => {
  const activities = await getActivityCalendarService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, activities, "Calendar fetched successfully")
  );
});

const getActivityTimeline = asyncHandler(async (req, res) => {
  const timeline = await getActivityTimelineService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, timeline, "Timeline fetched successfully")
  );
});

const updateActivityStatus = asyncHandler(async (req, res) => {
  const allowed = await canUpdateActivityStatus(req.user, req.params.activityId);
  if (!allowed) {
    throw new ApiError(403, "Only the assignee can update this activity's status.");
  }

  const activity = await updateActivityStatusService(req.params.activityId, req.user.id, req.body);

  return res.status(200).json(
    new ApiResponse(200, activity, "Activity status updated successfully")
  );
});

module.exports = {
  createActivity,
  getMyActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivityDashboard,
  getActivityCalendar,
  getActivityTimeline,
  updateActivityStatus,
};