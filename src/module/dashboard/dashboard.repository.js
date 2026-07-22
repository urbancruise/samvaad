const { postgresDb } = require("../../config/db");

const getOverviewCounts = async (userId) => {

  const [
    totalGoals,
    completedGoals,

    totalTasks,
    completedTasks,

    totalActivities,
    completedActivities,

    pendingActivities,
    inProgressActivities,

    overdueActivities,
  ] = await Promise.all([

    postgresDb.goal.count({
      where: {
        assignedToId: userId,
      },
    }),

    postgresDb.goal.count({
      where: {
        assignedToId: userId,
        status: "COMPLETED",
      },
    }),

    postgresDb.task.count({
      where: {
        assignedToId: userId,
      },
    }),

    postgresDb.task.count({
      where: {
        assignedToId: userId,
        status: "COMPLETED",
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        status: "COMPLETED",
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        status: "PENDING",
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        status: "IN_PROGRESS",
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        dueDate: {
          lt: new Date(),
        },
        status: {
          not: "COMPLETED",
        },
      },
    }),

  ]);

  return {
    totalGoals,
    completedGoals,

    totalTasks,
    completedTasks,

    totalActivities,
    completedActivities,

    pendingActivities,
    inProgressActivities,
    overdueActivities,
  };

};

const getTodaySummary = async (userId) => {

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const [
    todayTasks,
    todayActivities,
    dueToday,
    missedYesterday,
    workingTime,
  ] = await Promise.all([

    postgresDb.task.count({
      where: {
        assignedToId: userId,
        startDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        startDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          not: "COMPLETED",
        },
      },
    }),

    postgresDb.activity.count({
      where: {
        assignedToId: userId,
        dueDate: {
          gte: yesterday,
          lt: today,
        },
        status: {
          not: "COMPLETED",
        },
      },
    }),

    postgresDb.activity.aggregate({
      where: {
        assignedToId: userId,
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: {
        actualMinutes: true,
      },
    }),

  ]);

  return {
    todayTasks,
    todayActivities,
    dueToday,
    missedYesterday,
    workingMinutes:
      workingTime._sum.actualMinutes || 0,
  };

};

const getProgressAnalytics = async (userId) => {

  const [
    goals,
    tasks,
    activities,
  ] = await Promise.all([

    postgresDb.goal.findMany({
      where: {
        assignedToId: userId,
      },
      select: {
        progress: true,
      },
    }),

    postgresDb.task.findMany({
      where: {
        assignedToId: userId,
      },
      select: {
        progress: true,
      },
    }),

    postgresDb.activity.findMany({
      where: {
        assignedToId: userId,
      },
      select: {
        progress: true,
      },
    }),

  ]);

  const average = (items) => {

    if (!items.length) return 0;

    const total = items.reduce(
      (sum, item) => sum + item.progress,
      0
    );

    return Math.round(total / items.length);

  };

  return {

    goalProgress: average(goals),

    taskProgress: average(tasks),

    activityProgress: average(activities),

  };

};

const getPerformanceData = async (userId) => {

  const activities = await postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
    },
    select: {
      status: true,
      estimatedMinutes: true,
      actualMinutes: true,
      dueDate: true,
      completedAt: true,
    },
  });

  return activities;

};

const getTimelineData = async (userId) => {

  const activities = await postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      completedAt: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 20,
  });

  return activities;

};

const getRecentActivities = async (userId) => {

  return postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 10,
  });

};

const getUpcomingDeadlines = async (userId) => {

  return postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
      status: {
        not: "COMPLETED",
      },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      progress: true,
      task: {
        select: {
          title: true,
        },
      },
    },
    orderBy: [
      {
        dueDate: "asc",
      },
    ],
  });

};


module.exports = {
  getOverviewCounts,
  getTodaySummary,
  getProgressAnalytics,
  getPerformanceData,
  getTimelineData,
  getRecentActivities,
  getUpcomingDeadlines
};