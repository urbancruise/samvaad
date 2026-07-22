const { postgresDb } = require("../../config/db");

const createActivity = (data) => {
  return postgresDb.activity.create({
    data,
  });
};


const findActivityById = (activityId) => {
  return postgresDb.activity.findUnique({
    where: {
      id: activityId,
    },
    select: {
      id: true,
      title: true,
      status: true,      // 👈 CRITICAL: Required for validateStatusTransition
      progress: true,    // 👈 Required for calculating progress patches
      startedAt: true,   // 👈 Required for IN_PROGRESS check
      createdById: true,
      assignedToId: true,
      taskId: true,
      // 2. Include the task relation inside select
      task: {
        include: {
          goal: true,
        },
      },
    },
  });
};


const findActivitiesByTask = (taskId) => {
  return postgresDb.activity.findMany({
    where: {
      taskId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
};


const findActivitiesByUser = (
  userId,
  filters,
  page,
  limit,
  orderBy
) => {
  return postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
      ...filters,
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy,
    include: {
      task: {
        select: {
          id: true,
          title: true,
          goalId: true,
        },
      },
    },
  });
};


const countActivitiesByUser = (
  userId,
  filters
) => {
  return postgresDb.activity.count({
    where: {
      assignedToId: userId,
      ...filters,
    },
  });
};


const updateActivity = (
  activityId,
  data
) => {
  return postgresDb.activity.update({
    where: {
      id: activityId,
    },
    data,
  });
};

const deleteActivity = (
  activityId
) => {
  return postgresDb.activity.delete({
    where: {
      id: activityId,
    },
  });
};
const getActivityDashboard = (userId) => {
  return postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      progress: true,
      dueDate: true,
      taskId: true,
    },
  });
};

const getActivityCalendar = (userId) => {
  return postgresDb.activity.findMany({
    where: {
      assignedToId: userId,
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      dueDate: true,
      status: true,
      priority: true,
      progress: true,
      taskId: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });
};




module.exports = {
  createActivity,
  findActivityById,
  findActivitiesByTask,
  findActivitiesByUser,
  countActivitiesByUser,
  updateActivity,
  deleteActivity,
  getActivityDashboard,
  getActivityCalendar
};