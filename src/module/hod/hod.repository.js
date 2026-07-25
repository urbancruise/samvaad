const { mysqlDb, postgresDb } = require("../../config/db");

const formatName = (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

// Confirms managerId actually reports to hodId, via MySQL
const findManagedManager = async (hodId, managerId) => {
  return mysqlDb.users.findFirst({
    where: { id: Number(managerId), manager_id: Number(hodId) },
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

const getMyManagers = async (hodId) => {
  const managers = await mysqlDb.users.findMany({
    where: { manager_id: hodId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      officeEmail: true,
      is_active: true,
    },
  });

  if (managers.length === 0) return [];

  const managerIds = managers.map((m) => m.id);
  const now = new Date();

  const [goals, tasks, activities, performances] = await Promise.all([
    postgresDb.goal.findMany({
      where: { assignedToId: { in: managerIds } },
      select: { assignedToId: true, status: true },
    }),
    postgresDb.task.findMany({
      where: { assignedToId: { in: managerIds } },
      select: { assignedToId: true, status: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: { in: managerIds } },
      select: { assignedToId: true, status: true, dueDate: true },
    }),
    postgresDb.performance.findMany({
      where: { userId: { in: managerIds }, period: "MONTHLY" },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return managers.map((m) => {
    const mGoals = goals.filter((g) => g.assignedToId === m.id);
    const mTasks = tasks.filter((t) => t.assignedToId === m.id);
    const mActivities = activities.filter((a) => a.assignedToId === m.id);
    const performance = performances.find((p) => p.userId === m.id);

    return {
      id: m.id,
      fullName: formatName(m),
      email: m.officeEmail,
      username: m.username,
      isActive: m.is_active,
      performanceScore: performance?.performanceScore ?? 0,
      totalGoals: mGoals.length,
      completedGoals: mGoals.filter((g) => g.status === "COMPLETED").length,
      totalTasks: mTasks.length,
      completedTasks: mTasks.filter((t) => t.status === "COMPLETED").length,
      totalActivities: mActivities.length,
      completedActivities: mActivities.filter((a) => a.status === "COMPLETED").length,
      overdueActivities: mActivities.filter(
        (a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now
      ).length,
    };
  });
};

const getManagerProfile = async (hodId, managerId) => {
  const manager = await findManagedManager(hodId, managerId);
  if (!manager) return null;

  const now = new Date();
  const id = manager.id;

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
      id: manager.id,
      fullName: formatName(manager),
      email: manager.officeEmail,
      username: manager.username,
      role: manager.access_role,
      isActive: manager.is_active,
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

const getManagerGoals = async (hodId, managerId) => {
  const manager = await findManagedManager(hodId, managerId);
  if (!manager) return null;

  const goals = await postgresDb.goal.findMany({
    where: { assignedToId: manager.id },
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

const getManagerTasks = async (hodId, managerId) => {
  const manager = await findManagedManager(hodId, managerId);
  if (!manager) return null;

  const tasks = await postgresDb.task.findMany({
    where: { assignedToId: manager.id },
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

const getManagerActivities = async (hodId, managerId) => {
  const manager = await findManagedManager(hodId, managerId);
  if (!manager) return null;

  const activities = await postgresDb.activity.findMany({
    where: { assignedToId: manager.id },
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
  findManagedManager,
  getMyManagers,
  getManagerProfile,
  getManagerGoals,
  getManagerTasks,
  getManagerActivities,
};