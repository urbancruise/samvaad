const ApiError = require("../../utils/ApiError");
const { postgresDb } = require("../../config/db");
const { parseDate } = require("../../utils/date");

const { ensureOwner } = require("../activities/activity.permission");
const { createHistory } = require("../activities/activity.history.repository");

const {
  sendNotification,
  sendActivityUpdatedNotification,
  sendActivityCompletedNotification,
} = require("../notifications/notification.service");

const {
  createActivity,
  findActivityById,
  findActivitiesByUser,
  countActivitiesByUser,
  updateActivity,
  deleteActivity,
  getActivityDashboard,
  getActivityCalendar,
} = require("./activity.repository");

const { findTaskById } = require("../tasks/task.repository");
const { updateTaskProgress } = require("../tasks/task.service");
const { validateStatusTransition } = require("./activity.workflow");
const { canAssignToUser, canModifyResource, canUpdateStatus } = require("../teamLead/teamLead.permission");

const createActivityService = async (data) => {
  try {
    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.dueDate) data.dueDate = parseDate(data.dueDate);
    if (data.completedAt) data.completedAt = parseDate(data.completedAt);

    const task = await findTaskById(data.taskId);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    // The activity's assignee must match the task's assignee — this
    // allows a TL to create an activity inside an EMPLOYEE's task
    // (assigned to that same employee), not just inside their own tasks.
    if (task.assignedToId !== data.assignedToId) {
      throw new ApiError(
        403,
        "The activity must be assigned to the same person the task is assigned to."
      );
    }

    await canAssignToUser(data.createdById, data.assignedToId, data.creatorRole);

    const { creatorRole, ...activityData } = data;
    const activity = await createActivity({ ...activityData });

    await updateTaskProgress(task.id);
    await updateGoalProgress(task.goalId);

    return activity;
  } catch (error) {
    console.error("Failed to create activity in service:", error);
    throw error;
  }
};

const getMyActivitiesService = async (userId, query) => {
  const page = Number(query.page) || 1;
  const limit = Number(100) || 100;
  const filters = {};

  if (query.status) filters.status = query.status;
  if (query.priority) filters.priority = query.priority;
  if (query.taskId) filters.taskId = query.taskId;

  if (query.search) {
    filters.title = {
      contains: query.search,
      mode: "insensitive",
    };
  }

  const orderBy = {};
  if (query.sortBy) {
    orderBy[query.sortBy] = query.order || "desc";
  } else {
    orderBy.createdAt = "desc";
  }

  const activities = await findActivitiesByUser(
    userId,
    filters,
    page,
    limit,
    orderBy
  );

  const total = await countActivitiesByUser(userId, filters);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getActivityByIdService = async (activityId, userId) => {
  const activity = await findActivityById(activityId);
  if (!activity) {
    throw new ApiError(404, "Activity not found");
  }

  ensureOwner(activity, userId);
  return activity;
};

/**
 * FULL EDIT — creator only. Title, dates, priority, reassignment.
 * Does NOT accept status changes — use updateActivityStatusService.
 */
const updateActivityService = async (activityId, userId, data, userRole) => {
  try {
    const activity = await findActivityById(activityId);
    if (!activity) {
      throw new ApiError(404, "Activity not found");
    }

    canModifyResource(activity, userId);

    if (data.assignedToId) {
      await canAssignToUser(userId, data.assignedToId, userRole);
    }

    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.dueDate) data.dueDate = parseDate(data.dueDate);

    // strip any status fields — full edit is meta-only
    const { status, progress, completedAt, startedAt, ...safeData } = data;

    const updated = await updateActivity(activityId, safeData);

    await createHistory({
      activityId: activity.id,
      userId,
      action: "UPDATED",
      oldValue: activity,
      newValue: updated,
    });

    await sendNotification({
      title: "Activity Updated",
      message: `${updated.title} was updated`,
      type: "ACTIVITY_UPDATED",
      userId: updated.assignedToId,
    });

    return updated;
  } catch (error) {
    console.error("Failed to update activity in service:", error);
    throw error;
  }
};

/**
 * STATUS UPDATE — assignee only. This is the "tick as done" flow.
 * Cascades progress up to the parent Task and Goal automatically.
 */
const updateActivityStatusService = async (activityId, userId, data) => {
  try {
    const activity = await findActivityById(activityId);
    if (!activity) {
      throw new ApiError(404, "Activity not found");
    }

    canUpdateStatus(activity, userId);

    const patch = {};

    if (data.status) {
      validateStatusTransition(activity.status, data.status);
      patch.status = data.status;

      if (data.status === "COMPLETED") {
        patch.progress = 100;
        patch.completedAt = new Date();
      } else if (data.status === "PENDING") {
        patch.progress = 0;
      } else if (data.status === "IN_PROGRESS" && !activity.startedAt) {
        patch.startedAt = new Date();
      }
    }

    if (data.progress !== undefined && data.status !== "COMPLETED" && data.status !== "PENDING") {
      patch.progress = data.progress;
    }

    const updated = await updateActivity(activityId, patch);
    const task = await findTaskById(updated.taskId);

    await updateTaskProgress(updated.taskId);
    await updateGoalProgress(task.goalId);

    await createHistory({
      activityId: activity.id,
      userId,
      action: "STATUS_UPDATED",
      oldValue: { status: activity.status, progress: activity.progress },
      newValue: { status: updated.status, progress: updated.progress },
    });

    await sendActivityUpdatedNotification({
      userId: updated.createdById,
      activityTitle: updated.title,
    });

    if (updated.status === "COMPLETED") {
      await sendActivityCompletedNotification({
        userId: updated.createdById,
        activityTitle: updated.title,
      });
    }

    return updated;
  } catch (error) {
    console.error("Failed to update activity status in service:", error);
    throw error;
  }
};

const deleteActivityService = async (activityId, userId) => {
  try {
    const activity = await findActivityById(activityId);
    if (!activity) {
      throw new ApiError(404, "Activity not found");
    }

    canModifyResource(activity, userId);

    await deleteActivity(activityId);
    await updateTaskProgress(activity.taskId);

    const task = await findTaskById(activity.taskId);
    await updateGoalProgress(task.goalId);

    return true;
  } catch (error) {
    console.error("Failed to delete activity in service:", error);
    throw error;
  }
};

const updateGoalProgress = async (goalId) => {
  try {
    const goal = await postgresDb.goal.findUnique({
      where: { id: goalId },
      include: {
        tasks: {
          select: {
            progress: true,
            status: true,
          },
        },
      },
    });

    if (!goal) return;

    const tasks = goal.tasks;
    let progress = 0;

    if (tasks.length > 0) {
      const total = tasks.reduce((sum, task) => sum + task.progress, 0);
      progress = Math.round(total / tasks.length);
    }

    let status = "PENDING";
    if (progress === 100) {
      status = "COMPLETED";
    } else if (progress > 0) {
      status = "IN_PROGRESS";
    }

    await postgresDb.goal.update({
      where: { id: goalId },
      data: { progress, status },
    });
  } catch (error) {
    console.error("Failed to update goal progress:", error);
    throw error;
  }
};

const getActivityDashboardService = async (userId) => {
  const activities = await getActivityDashboard(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const dashboard = {
    total: activities.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    cancelled: 0,
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
  };

  activities.forEach((activity) => {
    switch (activity.status) {
      case "PENDING":
        dashboard.pending++;
        break;
      case "IN_PROGRESS":
        dashboard.inProgress++;
        break;
      case "COMPLETED":
        dashboard.completed++;
        break;
      case "ON_HOLD":
        dashboard.onHold++;
        break;
      case "CANCELLED":
        dashboard.cancelled++;
        break;
    }

    if (activity.dueDate) {
      const due = new Date(activity.dueDate);
      due.setHours(0, 0, 0, 0);

      if (due < today && activity.status !== "COMPLETED") {
        dashboard.overdue++;
      }
      if (due.getTime() === today.getTime()) {
        dashboard.dueToday++;
      }
      if (due >= today && due <= weekEnd) {
        dashboard.dueThisWeek++;
      }
    }
  });

  return dashboard;
};

const getActivityCalendarService = async (userId) => {
  return await getActivityCalendar(userId);
};

const getActivityTimelineService = async (userId) => {
  const activities = await getActivityCalendar(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeline = {
    today: [],
    upcoming: [],
    overdue: [],
    completed: [],
  };

  activities.forEach((activity) => {
    if (activity.status === "COMPLETED") {
      timeline.completed.push(activity);
      return;
    }

    if (!activity.dueDate) {
      timeline.upcoming.push(activity);
      return;
    }

    const due = new Date(activity.dueDate);
    due.setHours(0, 0, 0, 0);

    if (due.getTime() === today.getTime()) {
      timeline.today.push(activity);
    } else if (due < today) {
      timeline.overdue.push(activity);
    } else {
      timeline.upcoming.push(activity);
    }
  });

  return timeline;
};

module.exports = {
  createActivityService,
  getMyActivitiesService,
  getActivityByIdService,
  updateActivityService,
  updateActivityStatusService,
  deleteActivityService,
  updateGoalProgress,
  getActivityDashboardService,
  getActivityCalendarService,
  getActivityTimelineService,
};