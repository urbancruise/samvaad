const { postgresDb } = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { parseDate } = require("../../utils/date");

const {
  createTask,
  findTaskById,
  findTasksByUser,
  countTasksByUser,
  updateTask,
  deleteTask,
  getTaskDashboard,
  getCalendarTasks,
  getTaskTimeline,
} = require("./task.repository");

const { findGoalById } = require("../goals/goal.repository");
const { sendNotification } = require("../notifications/notification.service");
const { updateGoalProgress } = require("../goals/goal.service");
const { canAssignToUser, canModifyResource, canUpdateStatus } = require("../teamLead/teamLead.permission");

const createTaskService = async (data) => {
  try {
    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.dueDate) data.dueDate = parseDate(data.dueDate);
    if (data.completedAt) data.completedAt = parseDate(data.completedAt);

    const goal = await findGoalById(data.goalId);
    if (!goal) {
      throw new ApiError(404, "Goal not found");
    }

    // The task's assignee must match the goal's assignee — this allows
    // a TL to create a task inside an EMPLOYEE's goal (assigned to that
    // same employee), not just inside their own goals.
    if (goal.assignedToId !== data.assignedToId) {
      throw new ApiError(403, "The task must be assigned to the same person the goal is assigned to.");
    }

    await canAssignToUser(data.createdById, data.assignedToId, data.creatorRole);

    const { creatorRole, ...taskData } = data;
    const task = await createTask({ ...taskData });

    await sendNotification({
      userId: task.assignedToId,
      title: "New Task Assigned",
      message: `Task "${task.title}" has been assigned to you.`,
      type: "TASK_ASSIGNED",
    });

    return task;
  } catch (error) {
    console.error("Error in createTaskService:", error);
    throw error;
  }
};

const getMyTasksService = async (userId, query) => {
  try {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 100;
    const filters = {};

    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.goalId) filters.goalId = query.goalId;

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

    const tasks = await findTasksByUser(userId, filters, page, limit, orderBy);
    const total = await countTasksByUser(userId, filters);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error(`Error in getMyTasksService for user ${userId}:`, error);
    throw error;
  }
};

const getTaskByIdService = async (taskId, userId) => {
  try {
    const task = await findTaskById(taskId);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.assignedToId !== userId) {
      throw new ApiError(403, "Access denied");
    }

    return task;
  } catch (error) {
    console.error(`Error in getTaskByIdService for task ID ${taskId}:`, error);
    throw error;
  }
};

/**
 * FULL EDIT — creator only. Title, dates, priority, reassignment.
 */
const updateTaskService = async (taskId, userId, data, userRole) => {
  try {
    const task = await findTaskById(taskId);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    canModifyResource(task, userId);

    if (data.assignedToId) {
      await canAssignToUser(userId, data.assignedToId, userRole);
    }

    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.dueDate) data.dueDate = parseDate(data.dueDate);
    if (data.completedAt) data.completedAt = parseDate(data.completedAt);

    const updatedTask = await updateTask(taskId, data);

    await sendNotification({
      userId: updatedTask.assignedToId,
      title: "Task Updated",
      message: `Task "${updatedTask.title}" has been updated.`,
      type: "TASK_UPDATED",
    });

    return updatedTask;
  } catch (error) {
    console.error(`Error in updateTaskService for task ID ${taskId}:`, error);
    throw error;
  }
};

/**
 * STATUS UPDATE — assignee only. Restricted to status/progress fields.
 * Use this for the "tick as done" flow instead of updateTaskService.
 */
const updateTaskStatusService = async (taskId, userId, data) => {
  try {
    const task = await findTaskById(taskId);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    canUpdateStatus(task, userId);

    const allowed = {};
    if (data.status) allowed.status = data.status;
    if (data.progress !== undefined) allowed.progress = data.progress;
    if (data.status === "COMPLETED") allowed.completedAt = new Date();

    const updatedTask = await updateTask(taskId, allowed);

    await updateGoalProgress(updatedTask.goalId);

    if (updatedTask.status === "COMPLETED") {
      await sendNotification({
        userId: updatedTask.createdById,
        title: "Task Completed",
        message: `"${updatedTask.title}" was marked complete.`,
        type: "TASK_COMPLETED",
      });
    }

    return updatedTask;
  } catch (error) {
    console.error(`Error in updateTaskStatusService for task ID ${taskId}:`, error);
    throw error;
  }
};

const deleteTaskService = async (taskId, userId) => {
  try {
    const task = await findTaskById(taskId);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    canModifyResource(task, userId);
    await deleteTask(taskId);

    return true;
  } catch (error) {
    console.error(`Error in deleteTaskService for task ID ${taskId}:`, error);
    throw error;
  }
};

const updateTaskProgress = async (taskId) => {
  try {
    const task = await postgresDb.task.findUnique({
      where: { id: taskId },
      include: {
        activities: {
          select: {
            progress: true,
            status: true,
          },
        },
      },
    });

    if (!task) return null;

    const activities = task.activities;
    const totalActivities = activities.length;

    const completedActivities = activities.filter(
      (activity) => activity.status === "COMPLETED"
    ).length;

    const progress = totalActivities > 0
      ? Math.round(activities.reduce((sum, a) => sum + a.progress, 0) / totalActivities)
      : 0;

    let status = "PENDING";
    if (completedActivities === totalActivities && totalActivities > 0) {
      status = "COMPLETED";
    } else if (completedActivities > 0) {
      status = "IN_PROGRESS";
    }

    const updatedTask = await postgresDb.task.update({
      where: { id: taskId },
      data: { progress, status },
    });

    await updateGoalProgress(updatedTask.goalId);

    return updatedTask;
  } catch (error) {
    console.error(`Error in updateTaskProgress for task ID ${taskId}:`, error);
    throw error;
  }
};

const getTaskDashboardService = async (userId) => {
  try {
    const tasks = await getTaskDashboard(userId);
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    const dashboard = {
      total: tasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
    };

    tasks.forEach((task) => {
      if (task.status === "PENDING") dashboard.pending++;
      if (task.status === "IN_PROGRESS") dashboard.inProgress++;
      if (task.status === "COMPLETED") dashboard.completed++;

      if (task.dueDate) {
        const due = new Date(task.dueDate);

        if (due < today && task.status !== "COMPLETED") {
          dashboard.overdue++;
        }
        if (due.toDateString() === today.toDateString()) {
          dashboard.dueToday++;
        }
        if (due >= today && due <= endOfWeek) {
          dashboard.dueThisWeek++;
        }
      }
    });

    return dashboard;
  } catch (error) {
    console.error(`Error in getTaskDashboardService for user ${userId}:`, error);
    throw error;
  }
};

const getCalendarTasksService = async (userId) => {
  try {
    const tasks = await getCalendarTasks(userId);

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      start: task.startDate,
      end: task.dueDate,
      priority: task.priority,
      status: task.status,
      progress: task.progress,
      goal: task.goal,
      allDay: false,
    }));
  } catch (error) {
    console.error(`Error in getCalendarTasksService for user ${userId}:`, error);
    throw error;
  }
};

const getTaskTimelineService = async (userId) => {
  try {
    const tasks = await getTaskTimeline(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const timeline = {
      today: [],
      upcoming: [],
      overdue: [],
      completed: [],
    };

    tasks.forEach((task) => {
      if (task.status === "COMPLETED") {
        timeline.completed.push(task);
        return;
      }

      if (!task.dueDate) {
        timeline.upcoming.push(task);
        return;
      }

      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);

      if (due.getTime() === today.getTime()) {
        timeline.today.push(task);
      } else if (due < today) {
        timeline.overdue.push(task);
      } else {
        timeline.upcoming.push(task);
      }
    });

    return timeline;
  } catch (error) {
    console.error(`Error in getTaskTimelineService for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  createTaskService,
  getMyTasksService,
  getTaskByIdService,
  updateTaskService,
  updateTaskStatusService,
  deleteTaskService,
  getTaskDashboardService,
  updateTaskProgress,
  getCalendarTasksService,
  getTaskTimelineService,
};