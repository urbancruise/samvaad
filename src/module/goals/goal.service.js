const {
  createGoal,
  findGoalById,
  findGoalsByUser,
  countGoalsByUser,
  updateGoal,
  deleteGoal,
} = require("./goal.repository");

const { canAssignToUser, canModifyResource } = require("../teamLead/teamLead.permission");
const { postgresDb } = require("../../config/db");

const ApiError = require("../../utils/ApiError");
const { parseDate } = require("../../utils/date");

const createGoalService = async (data) => {
  try {
    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.dueDate) data.dueDate = parseDate(data.dueDate);
    if (data.completedAt) data.completedAt = parseDate(data.completedAt);

    await canAssignToUser(data.createdById, data.assignedToId, data.creatorRole);

    // creatorRole was only needed for the permission check, don't persist it
    const { creatorRole, ...goalData } = data;

    return await createGoal({ ...goalData });
  } catch (error) {
    console.error("Error in createGoalService:", error);
    throw error;
  }
};

const getMyGoalsService = async (userId, query) => {
  try {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 100;
    const filters = {};

    if (query.status) filters.status = query.status;
    if (query.goalType) filters.goalType = query.goalType;
    if (query.priority) filters.priority = query.priority;
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

    const [goals, total] = await Promise.all([
      findGoalsByUser(userId, filters, page, limit, orderBy),
      countGoalsByUser(userId, filters)
    ]);

    return {
      goals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error(`Error in getMyGoalsService for user ${userId}:`, error);
    throw error;
  }
};

const getGoalByIdService = async (goalId, userId) => {
  try {
    const goal = await findGoalById(goalId);

    if (!goal) {
      throw new ApiError(404, "Goal not found");
    }

    if (goal.assignedToId !== userId) {
      throw new ApiError(403, "Access denied");
    }

    return goal;
  } catch (error) {
    console.error(`Error in getGoalByIdService for goal ${goalId}:`, error);
    throw error;
  }
};

/**
 * FULL EDIT — creator only. Can change title, dates, priority,
 * reassignment, etc. Cannot be called by the assignee unless they
 * are also the creator.
 */
const updateGoalService = async (goalId, userId, data, userRole) => {
  try {
    const goal = await findGoalById(goalId);

    if (!goal) {
      throw new ApiError(404, "Goal not found");
    }

    canModifyResource(goal, userId);

    if (data.assignedToId && data.assignedToId !== goal.assignedToId) {
      await canAssignToUser(userId, data.assignedToId, userRole);
    }

    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.dueDate) data.dueDate = parseDate(data.dueDate);
    if (data.completedAt) data.completedAt = parseDate(data.completedAt);

    return await updateGoal(goalId, data);
  } catch (error) {
    console.error(`Error in updateGoalService for goal ${goalId}:`, error);
    throw error;
  }
};

const deleteGoalService = async (goalId, userId) => {
  try {
    const goal = await findGoalById(goalId);

    if (!goal) {
      throw new ApiError(404, "Goal not found");
    }

    canModifyResource(goal, userId);
    await deleteGoal(goalId);

    return true;
  } catch (error) {
    console.error(`Error in deleteGoalService for goal ${goalId}:`, error);
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
            id: true,
            progress: true,
            status: true,
          },
        },
      },
    });

    if (!goal) return;
    const tasks = goal.tasks;
    const totalTasks = tasks.length;

    if (totalTasks === 0) {
      await postgresDb.goal.update({
        where: { id: goalId },
        data: {
          progress: 0,
          status: "PENDING",
        },
      });
      return;
    }

    const completedTasks = tasks.filter(task => task.status === "COMPLETED").length;
    const progress = Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / totalTasks);

    let status = "PENDING";
    if (completedTasks === totalTasks) {
      status = "COMPLETED";
    } else if (completedTasks > 0 || tasks.some(t => t.status === "IN_PROGRESS" || t.progress > 0)) {
      status = "IN_PROGRESS";
    }

    await postgresDb.goal.update({
      where: { id: goalId },
      data: { progress, status },
    });
  } catch (error) {
    console.error(`Error updating progress for goal ${goalId}:`, error);
    throw error;
  }
};

const getTodayGoalsService = async (userId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return await postgresDb.goal.findMany({
      where: {
        assignedToId: userId,
        startDate: { lte: today },
        dueDate: { gte: today },
      },
      include: {
        tasks: {
          where: {
            assignedToId: userId,
            startDate: { lt: tomorrow },
            dueDate: { gte: today },
          },
          include: {
            activities: {
              where: {
                assignedToId: userId,
                startDate: { lt: tomorrow },
                dueDate: { gte: today },
              },
              orderBy: { dueDate: "asc" },
            },
          },
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  } catch (error) {
    console.error(`Error fetching today's goals for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  createGoalService,
  getMyGoalsService,
  getGoalByIdService,
  updateGoalService,
  deleteGoalService,
  updateGoalProgress,
  getTodayGoalsService,
};