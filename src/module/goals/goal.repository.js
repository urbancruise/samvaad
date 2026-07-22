const { postgresDb } = require("../../config/db");

const createGoal = async (data) => {
  try {
    return await postgresDb.goal.create({
      data,
    });
  } catch (error) {
    console.error("Error creating goal in repository:", error);
    throw error;
  }
};

const findGoalById = async (goalId) => {
  try {
    return await postgresDb.goal.findUnique({
      where: {
        id: goalId,
      },
    });
  } catch (error) {
    console.error(`Error finding goal by ID ${goalId} in repository:`, error);
    throw error;
  }
};

const findGoalsByUser = async (userId, filters, page, limit, orderBy) => {
  try {
    return await postgresDb.goal.findMany({
      where: {
        assignedToId: userId,
        ...filters,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    });
  } catch (error) {
    console.error(`Error fetching goals for user ${userId} in repository:`, error);
    throw error;
  }
};

const countGoalsByUser = async (userId, filters) => {
  try {
    return await postgresDb.goal.count({
      where: {
        assignedToId: userId,
        ...filters,
      },
    });
  } catch (error) {
    console.error(`Error counting goals for user ${userId} in repository:`, error);
    throw error;
  }
};

const updateGoal = async (goalId, data) => {
  try {
    return await postgresDb.goal.update({
      where: {
        id: goalId,
      },
      data,
    });
  } catch (error) {
    console.error(`Error updating goal ID ${goalId} in repository:`, error);
    throw error;
  }
};

const deleteGoal = async (goalId) => {
  try {
    return await postgresDb.goal.delete({
      where: {
        id: goalId,
      },
    });
  } catch (error) {
    console.error(`Error deleting goal ID ${goalId} in repository:`, error);
    throw error;
  }
};

module.exports = {
  createGoal,
  findGoalById,
  findGoalsByUser,
  countGoalsByUser,
  updateGoal,
  deleteGoal,
};