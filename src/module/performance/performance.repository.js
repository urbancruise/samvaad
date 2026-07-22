const { postgresDb } = require("../../config/db");

const getPerformanceMetrics = async (userId) => {
  try {
    const now = new Date();

    const [
      goals,
      completedGoals,
      tasks,
      completedTasks,
      activities,
      completedActivities,
      overdueActivities
    ] = await Promise.all([
      postgresDb.goal.count({ where: { assignedToId: userId } }),
      postgresDb.goal.count({ where: { assignedToId: userId, status: "COMPLETED" } }),
      postgresDb.task.count({ where: { assignedToId: userId } }),
      postgresDb.task.count({ where: { assignedToId: userId, status: "COMPLETED" } }),
      postgresDb.activity.count({ where: { assignedToId: userId } }),
      postgresDb.activity.count({ where: { assignedToId: userId, status: "COMPLETED" } }),
      postgresDb.activity.count({
        where: {
          assignedToId: userId,
          status: { not: "COMPLETED" },
          dueDate: { lt: now }
        }
      })
    ]);

    const completedList = await postgresDb.activity.findMany({
      where: {
        assignedToId: userId,
        status: "COMPLETED"
      },
      select: {
        completedAt: true,
        dueDate: true
      }
    });

    const onTimeActivities = completedList.filter(item =>
      item.completedAt &&
      item.dueDate &&
      item.completedAt <= item.dueDate
    ).length;

    return {
      goals,
      completedGoals,
      tasks,
      completedTasks,
      activities,
      completedActivities,
      onTimeActivities,
      overdueActivities
    };
  } catch (error) {
    console.error(`Error in getPerformanceMetrics repository for user ${userId}:`, error);
    throw error;
  }
};

const savePerformanceSnapshot = async (data) => {
  try {
    return await postgresDb.performance.upsert({
      where: {
        userId_period: {
          userId: data.userId,
          period: data.period
        }
      },
      update: data,
      create: data
    });
  } catch (error) {
    console.error("Error in savePerformanceSnapshot repository:", error);
    throw error;
  }
};

const upsertPerformance = async (userId, period, startDate, endDate, data) => {
  try {
    return await postgresDb.performance.upsert({
      where: {
        userId_period_startDate: {
          userId,
          period,
          startDate
        }
      },
      update: { ...data },
      create: {
        userId,
        period,
        startDate,
        endDate,
        ...data
      }
    });
  } catch (error) {
    console.error(`Error in upsertPerformance repository for user ${userId}:`, error);
    throw error;
  }
};

const createAchievement = async (data) => {
  try {
    return await postgresDb.achievement.create({ data });
  } catch (error) {
    console.error("Error in createAchievement repository:", error);
    throw error;
  }
};

const findAchievement = async (userId, badge) => {
  try {
    return await postgresDb.achievement.findUnique({
      where: {
        userId_badge: {
          userId,
          badge
        }
      }
    });
  } catch (error) {
    console.error(`Error in findAchievement repository for user ${userId} and badge ${badge}:`, error);
    throw error;
  }
};

const getAchievements = async (userId) => {
  try {
    return await postgresDb.achievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: "desc" }
    });
  } catch (error) {
    console.error(`Error in getAchievements repository for user ${userId}:`, error);
    throw error;
  }
};

const getPerformanceAnalytics = async (userId, period) => {
  try {
    return await postgresDb.performance.findMany({
      where: {
        userId,
        period
      },
      orderBy: { startDate: "asc" }
    });
  } catch (error) {
    console.error(`Error in getPerformanceAnalytics repository for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  getPerformanceMetrics,
  savePerformanceSnapshot,
  upsertPerformance,
  createAchievement,
  findAchievement,
  getAchievements,
  getPerformanceAnalytics
};