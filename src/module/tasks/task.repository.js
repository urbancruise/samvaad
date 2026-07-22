const { postgresDb } = require("../../config/db");

/**
 * Create Task
 */
const createTask = async (data) => {
  try {
    return await postgresDb.task.create({
      data,
    });
  } catch (error) {
    console.error("Error creating task in repository:", error);
    throw error;
  }
};

/**
 * Find Task By Id
 */
const findTaskById = async (taskId) => {
  try {
    return await postgresDb.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        goal: true,
        activities: true,
      },
    });
  } catch (error) {
    console.error(`Error finding task by ID ${taskId} in repository:`, error);
    throw error;
  }
};

/**
 * Find Tasks Of User
 */
const findTasksByUser = async (userId, filters, page, limit, orderBy) => {
  try {
    return await postgresDb.task.findMany({
      where: {
        assignedToId: userId,
        ...filters,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        goal: {
          select: {
            id: true,
            title: true,
            goalType: true,
          },
        },
      },
    });
  } catch (error) {
    console.error(`Error finding tasks for user ${userId} in repository:`, error);
    throw error;
  }
};

/**
 * Count Tasks
 */
const countTasksByUser = async (userId, filters) => {
  try {
    return await postgresDb.task.count({
      where: {
        assignedToId: userId,
        ...filters,
      },
    });
  } catch (error) {
    console.error(`Error counting tasks for user ${userId} in repository:`, error);
    throw error;
  }
};

/**
 * Update Task
 */
const updateTask = async (taskId, data) => {
  try {
    return await postgresDb.task.update({
      where: {
        id: taskId,
      },
      data,
    });
  } catch (error) {
    console.error(`Error updating task ID ${taskId} in repository:`, error);
    throw error;
  }
};

/**
 * Delete Task
 */
const deleteTask = async (taskId) => {
  try {
    return await postgresDb.task.delete({
      where: {
        id: taskId,
      },
    });
  } catch (error) {
    console.error(`Error deleting task ID ${taskId} in repository:`, error);
    throw error;
  }
};

/**
 * Get Task Dashboard Metrics
 */
const getTaskDashboard = async (userId) => {
  try {
    return await postgresDb.task.findMany({
      where: {
        assignedToId: userId,
      },
      select: {
        id: true,
        status: true,
        dueDate: true,
        progress: true,
      },
    });
  } catch (error) {
    console.error(`Error fetching task dashboard for user ${userId} in repository:`, error);
    throw error;
  }
};

/**
 * Get Tasks For Calendar View
 */
const getCalendarTasks = async (userId) => {
  try {
    return await postgresDb.task.findMany({
      where: {
        assignedToId: userId,
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        dueDate: true,
        priority: true,
        status: true,
        progress: true,
        goal: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        startDate: "asc",
      },
    });
  } catch (error) {
    console.error(`Error fetching calendar tasks for user ${userId} in repository:`, error);
    throw error;
  }
};

/**
 * Get Tasks For Timeline View
 */
const getTaskTimeline = async (userId) => {
  try {
    return await postgresDb.task.findMany({
      where: {
        assignedToId: userId,
      },
      include: {
        goal: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });
  } catch (error) {
    console.error(`Error fetching task timeline for user ${userId} in repository:`, error);
    throw error;
  }
};

module.exports = {
  createTask,
  findTaskById,
  findTasksByUser,
  countTasksByUser,
  updateTask,
  deleteTask,
  getTaskDashboard,
  getCalendarTasks,
  getTaskTimeline,
};