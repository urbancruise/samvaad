const { mysqlDb, postgresDb } = require("../../config/db");

const formatName = (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

// Confirms tlId actually reports to managerId, via MySQL
const findManagedTL = async (managerId, tlId) => {
  return mysqlDb.users.findFirst({
    where: { id: Number(tlId), manager_id: Number(managerId) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      officeEmail: true,
      access_role: true,
      is_active: true,
    },
  });
};

const getMyTeamLeads = async (managerId) => {
  const teamLeads = await mysqlDb.users.findMany({
    where: { manager_id: managerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      officeEmail: true,
      is_active: true,
    },
  });

  if (teamLeads.length === 0) return [];

  const tlIds = teamLeads.map((tl) => tl.id);
  const now = new Date();

  const [goals, tasks, activities, performances] = await Promise.all([
    postgresDb.goal.findMany({
      where: { assignedToId: { in: tlIds } },
      select: { assignedToId: true, status: true },
    }),
    postgresDb.task.findMany({
      where: { assignedToId: { in: tlIds } },
      select: { assignedToId: true, status: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: { in: tlIds } },
      select: { assignedToId: true, status: true, dueDate: true },
    }),
    postgresDb.performance.findMany({
      where: { userId: { in: tlIds }, period: "MONTHLY" },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return teamLeads.map((tl) => {
    const tlGoals = goals.filter((g) => g.assignedToId === tl.id);
    const tlTasks = tasks.filter((t) => t.assignedToId === tl.id);
    const tlActivities = activities.filter((a) => a.assignedToId === tl.id);
    const performance = performances.find((p) => p.userId === tl.id);

    return {
      id: tl.id,
      fullName: formatName(tl),
      email: tl.officeEmail,
      username: tl.username,
      isActive: tl.is_active,
      performanceScore: performance?.performanceScore ?? 0,
      totalGoals: tlGoals.length,
      completedGoals: tlGoals.filter((g) => g.status === "COMPLETED").length,
      totalTasks: tlTasks.length,
      completedTasks: tlTasks.filter((t) => t.status === "COMPLETED").length,
      totalActivities: tlActivities.length,
      completedActivities: tlActivities.filter((a) => a.status === "COMPLETED").length,
      overdueActivities: tlActivities.filter(
        (a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now
      ).length,
    };
  });
};

const getTeamLeadProfile = async (managerId, tlId) => {
  const tl = await findManagedTL(managerId, tlId);
  if (!tl) return null;

  const now = new Date();
  const id = tl.id;

  const [
    totalGoals, completedGoals,
    totalTasks, completedTasks,
    totalActivities, completedActivities, pendingActivities, overdueActivities,
    performance,
  ] = await Promise.all([
    postgresDb.goal.count({ where: { assignedToId: id } }),
    postgresDb.goal.count({ where: { assignedToId: id, status: "COMPLETED" } }),
    postgresDb.task.count({ where: { assignedToId: id } }),
    postgresDb.task.count({ where: { assignedToId: id, status: "COMPLETED" } }),
    postgresDb.activity.count({ where: { assignedToId: id } }),
    postgresDb.activity.count({ where: { assignedToId: id, status: "COMPLETED" } }),
    postgresDb.activity.count({ where: { assignedToId: id, status: { not: "COMPLETED" } } }),
    postgresDb.activity.count({
      where: { assignedToId: id, status: { not: "COMPLETED" }, dueDate: { lt: now } },
    }),
    postgresDb.performance.findFirst({
      where: { userId: id, period: "MONTHLY" },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return {
    profile: {
      id: tl.id,
      fullName: formatName(tl),
      email: tl.officeEmail,
      username: tl.username,
      role: tl.access_role,
      isActive: tl.is_active,
    },
    overview: {
      totalGoals, completedGoals,
      totalTasks, completedTasks,
      totalActivities, completedActivities, pendingActivities, overdueActivities,
    },
    performance: {
      performanceScore: performance?.performanceScore ?? 0,
      completionRate: performance?.completionRate ?? 0,
      productivityScore: performance?.productivityScore ?? 0,
    },
  };
};

const getTeamLeadGoals = async (managerId, tlId) => {
  const tl = await findManagedTL(managerId, tlId);
  if (!tl) return null;

  const goals = await postgresDb.goal.findMany({
    where: { assignedToId: tl.id },
    include: { tasks: { select: { status: true } } },
    orderBy: { dueDate: "asc" },
  });

  return goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    goalType: goal.goalType,
    priority: goal.priority,
    status: goal.status,
    progress: goal.progress,
    startDate: goal.startDate,
    dueDate: goal.dueDate,
    createdById: goal.createdById,
    assignedToId: goal.assignedToId,
    taskCount: goal.tasks.length,
    completedTasks: goal.tasks.filter((t) => t.status === "COMPLETED").length,
  }));
};

const getTeamLeadTasks = async (managerId, tlId) => {
  const tl = await findManagedTL(managerId, tlId);
  if (!tl) return null;

  const tasks = await postgresDb.task.findMany({
    where: { assignedToId: tl.id },
    include: {
      goal: { select: { id: true, title: true } },
      activities: { select: { status: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedHours: task.estimatedHours,
    createdById: task.createdById,
    assignedToId: task.assignedToId,
    goal: task.goal,
    activityCount: task.activities.length,
    completedActivities: task.activities.filter((a) => a.status === "COMPLETED").length,
  }));
};

const getTeamLeadActivities = async (managerId, tlId) => {
  const tl = await findManagedTL(managerId, tlId);
  if (!tl) return null;

  const activities = await postgresDb.activity.findMany({
    where: { assignedToId: tl.id },
    include: {
      task: {
        select: { id: true, title: true, goal: { select: { id: true, title: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return activities.map((activity) => ({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    priority: activity.priority,
    status: activity.status,
    progress: activity.progress,
    estimatedMinutes: activity.estimatedMinutes,
    actualMinutes: activity.actualMinutes,
    startedAt: activity.startedAt,
    completedAt: activity.completedAt,
    dueDate: activity.dueDate,
    createdById: activity.createdById,
    assignedToId: activity.assignedToId,
    task: activity.task,
    goal: activity.task.goal,
  }));
};

module.exports = {
  findManagedTL,
  getMyTeamLeads,
  getTeamLeadProfile,
  getTeamLeadGoals,
  getTeamLeadTasks,
  getTeamLeadActivities,
};