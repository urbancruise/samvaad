const { postgresDb } = require("../../config/db");

const getCalendarData = async (userId, start, end) => {
  try {
    const [goals, tasks, activities] = await Promise.all([
      postgresDb.goal.findMany({
        where: {
          assignedToId: userId,
          OR: [
            { startDate: { gte: start, lte: end } },
            { dueDate: { gte: start, lte: end } },
          ],
        },
      }),
      postgresDb.task.findMany({
        where: {
          assignedToId: userId,
          OR: [
            { startDate: { gte: start, lte: end } },
            { dueDate: { gte: start, lte: end } },
          ],
        },
      }),
      postgresDb.activity.findMany({
        where: {
          assignedToId: userId,
          OR: [
            { startDate: { gte: start, lte: end } },
            { dueDate: { gte: start, lte: end } },
          ],
        },
      }),
    ]);

    return { goals, tasks, activities };
  } catch (error) {
    console.error("Error fetching calendar data in repository:", error);
    throw error;
  }
};

const getTodayAgenda = async (userId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [goals, tasks, activities] = await Promise.all([
      postgresDb.goal.findMany({
        where: {
          assignedToId: userId,
          startDate: { gte: today, lt: tomorrow },
        },
      }),
      postgresDb.task.findMany({
        where: {
          assignedToId: userId,
          startDate: { gte: today, lt: tomorrow },
        },
      }),
      postgresDb.activity.findMany({
        where: {
          assignedToId: userId,
          startDate: { gte: today, lt: tomorrow },
        },
      }),
    ]);

    return { goals, tasks, activities };
  } catch (error) {
    console.error("Error fetching today's agenda in repository:", error);
    throw error;
  }
};

const getWeeklyAgenda = async (userId, weekStart, weekEnd) => {
  try {
    const [goals, tasks, activities] = await Promise.all([
      postgresDb.goal.findMany({
        where: {
          assignedToId: userId,
          startDate: { gte: weekStart, lte: weekEnd },
        },
      }),
      postgresDb.task.findMany({
        where: {
          assignedToId: userId,
          startDate: { gte: weekStart, lte: weekEnd },
        },
      }),
      postgresDb.activity.findMany({
        where: {
          assignedToId: userId,
          startDate: { gte: weekStart, lte: weekEnd },
        },
      }),
    ]);

    return { goals, tasks, activities };
  } catch (error) {
    console.error("Error fetching weekly agenda in repository:", error);
    throw error;
  }
};

const getMonthlyCalendar = async (userId, startDate, endDate, filters) => {
  try {
    const priorityFilter = filters.priority ? { in: filters.priority.split(",") } : undefined;
    const statusFilter = filters.status ? { in: filters.status.split(",") } : undefined;
    const types = filters.type ? filters.type.split(",") : ["GOAL", "TASK", "ACTIVITY"];

    const promises = [];

    if (types.includes("GOAL")) {
      promises.push(
        postgresDb.goal.findMany({
          where: {
            assignedToId: userId,
            priority: priorityFilter,
            status: statusFilter,
            startDate: { lte: endDate },
            dueDate: { gte: startDate },
          },
        })
      );
    } else {
      promises.push([]);
    }

    if (types.includes("TASK")) {
      promises.push(
        postgresDb.task.findMany({
          where: {
            assignedToId: userId,
            priority: priorityFilter,
            status: statusFilter,
            startDate: { lte: endDate },
            dueDate: { gte: startDate },
          },
        })
      );
    } else {
      promises.push([]);
    }

    if (types.includes("ACTIVITY")) {
      promises.push(
        postgresDb.activity.findMany({
          where: {
            assignedToId: userId,
            priority: priorityFilter,
            status: statusFilter,
            startDate: { lte: endDate },
            dueDate: { gte: startDate },
          },
        })
      );
    } else {
      promises.push([]);
    }

    const [goals, tasks, activities] = await Promise.all(promises);
    return { goals, tasks, activities };
  } catch (error) {
    console.error("Error fetching monthly calendar in repository:", error);
    throw error;
  }
};

const rescheduleEvent = async (id, type, startDate, dueDate) => {
  try {
    const eventType = String(type).trim().toUpperCase();
    console.log(eventType, " this is event");

    switch (eventType) {
      case "GOAL":
        return await postgresDb.goal.update({
          where: { id },
          data: { startDate, dueDate },
        });
      case "TASK":
        return await postgresDb.task.update({
          where: { id },
          data: { startDate, dueDate },
        });
      case "ACTIVITY":
        return await postgresDb.activity.update({
          where: { id },
          data: { startDate, dueDate },
        });
      default:
        throw new Error(`Invalid event type: ${type}`);
    }
  } catch (error) {
    console.error(`Error rescheduling ${type} in repository:`, error);
    throw error;
  }
};

const checkActivityConflict = async (userId, activityId, startDate, dueDate) => {
  try {
    return await postgresDb.activity.findFirst({
      where: {
        assignedToId: userId,
        id: { not: activityId },
        status: { not: "COMPLETED" },
        AND: [
          { startDate: { lt: dueDate } },
          { dueDate: { gt: startDate } },
        ],
      },
    });
  } catch (error) {
    console.error("Error checking activity conflict in repository:", error);
    throw error;
  }
};

const searchCalendar = async (userId, filters) => {
  try {
    const { search, priority, status, type, startDate, endDate } = filters;

    const searchFilter = search ? { contains: search, mode: "insensitive" } : undefined;
    const priorityFilter = priority ? { in: priority.split(",") } : undefined;
    const statusFilter = status ? { in: status.split(",") } : undefined;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const types = type ? type.split(",") : ["GOAL", "TASK", "ACTIVITY"];
    const promises = [];

    if (types.includes("GOAL")) {
      promises.push(
        postgresDb.goal.findMany({
          where: {
            assignedToId: userId,
            title: searchFilter,
            priority: priorityFilter,
            status: statusFilter,
            startDate: Object.keys(dateFilter).length ? dateFilter : undefined,
          },
        })
      );
    } else {
      promises.push([]);
    }

    if (types.includes("TASK")) {
      promises.push(
        postgresDb.task.findMany({
          where: {
            assignedToId: userId,
            title: searchFilter,
            priority: priorityFilter,
            status: statusFilter,
            startDate: Object.keys(dateFilter).length ? dateFilter : undefined,
          },
        })
      );
    } else {
      promises.push([]);
    }

    if (types.includes("ACTIVITY")) {
      promises.push(
        postgresDb.activity.findMany({
          where: {
            assignedToId: userId,
            title: searchFilter,
            priority: priorityFilter,
            status: statusFilter,
            startDate: Object.keys(dateFilter).length ? dateFilter : undefined,
          },
        })
      );
    } else {
      promises.push([]);
    }

    const [goals, tasks, activities] = await Promise.all(promises);
    return { goals, tasks, activities };
  } catch (error) {
    console.error("Error executing calendar search in repository:", error);
    throw error;
  }
};

const getCalendarAnalytics = async (userId, startDate, endDate) => {
  try {
    const [goals, tasks, activities, completed, overdue] = await Promise.all([
      postgresDb.goal.count({
        where: {
          assignedToId: userId,
          startDate: { gte: startDate, lte: endDate },
        },
      }),
      postgresDb.task.count({
        where: {
          assignedToId: userId,
          startDate: { gte: startDate, lte: endDate },
        },
      }),
      postgresDb.activity.count({
        where: {
          assignedToId: userId,
          startDate: { gte: startDate, lte: endDate },
        },
      }),
      postgresDb.activity.count({
        where: {
          assignedToId: userId,
          status: "COMPLETED",
          startDate: { gte: startDate, lte: endDate },
        },
      }),
      postgresDb.activity.count({
        where: {
          assignedToId: userId,
          status: { not: "COMPLETED" },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const workload = await postgresDb.activity.groupBy({
      by: ["startDate"],
      where: {
        assignedToId: userId,
        startDate: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    const upcomingDeadlines = await postgresDb.activity.findMany({
      where: {
        assignedToId: userId,
        status: { not: "COMPLETED" },
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        title: true,
        dueDate: true,
      },
    });

    return {
      goals,
      tasks,
      activities,
      completed,
      overdue,
      workload,
      upcomingDeadlines,
    };
  } catch (error) {
    console.error("Error generating calendar analytics in repository:", error);
    throw error;
  }
};

module.exports = {
  getCalendarData,
  getTodayAgenda,
  getWeeklyAgenda,
  getMonthlyCalendar,
  rescheduleEvent,
  checkActivityConflict,
  searchCalendar,
  getCalendarAnalytics,
};