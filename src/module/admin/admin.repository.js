const { mysqlDb, postgresDb } = require("../../config/db");

const formatName = (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

/**
 * Unlike every other role's repository (findManagedEmployee/TL/Manager,
 * all scoped by manager_id), SUPER_ADMIN sees the entire org — no
 * manager_id filter, no ownership check on individual users.
 */
const getAllUsers = async (query = {}) => {
  const where = {};
  if (query.role) where.access_role = query.role;
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { username: { contains: query.search, mode: "insensitive" } },
      { officeEmail: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const users = await mysqlDb.users.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      officeEmail: true,
      access_role: true,
      manager_id: true,
      is_active: true,
    },
    orderBy: { firstName: "asc" },
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const now = new Date();

  const [goals, tasks, activities, performances] = await Promise.all([
    postgresDb.goal.findMany({
      where: { assignedToId: { in: userIds } },
      select: { assignedToId: true, status: true },
    }),
    postgresDb.task.findMany({
      where: { assignedToId: { in: userIds } },
      select: { assignedToId: true, status: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: { in: userIds } },
      select: { assignedToId: true, status: true, dueDate: true },
    }),
    postgresDb.performance.findMany({
      where: { userId: { in: userIds }, period: "MONTHLY" },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return users.map((u) => {
    const uGoals = goals.filter((g) => g.assignedToId === u.id);
    const uTasks = tasks.filter((t) => t.assignedToId === u.id);
    const uActivities = activities.filter((a) => a.assignedToId === u.id);
    const performance = performances.find((p) => p.userId === u.id);

    return {
      id: u.id,
      fullName: formatName(u),
      email: u.officeEmail,
      username: u.username,
      role: u.access_role,
      managerId: u.manager_id,
      isActive: u.is_active,
      performanceScore: performance?.performanceScore ?? 0,
      totalGoals: uGoals.length,
      completedGoals: uGoals.filter((g) => g.status === "COMPLETED").length,
      totalTasks: uTasks.length,
      completedTasks: uTasks.filter((t) => t.status === "COMPLETED").length,
      totalActivities: uActivities.length,
      completedActivities: uActivities.filter((a) => a.status === "COMPLETED").length,
      overdueActivities: uActivities.filter(
        (a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now
      ).length,
    };
  });
};

// No manager_id constraint — SUPER_ADMIN can view any user by id.
const findAnyUser = async (userId) => {
  return mysqlDb.users.findFirst({
    where: { id: Number(userId) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      officeEmail: true,
      access_role: true,
      manager_id: true,
      is_active: true,
    },
  });
};

const getUserProfile = async (userId) => {
  const user = await findAnyUser(userId);
  if (!user) return null;

  const now = new Date();
  const id = user.id;

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
      id: user.id,
      fullName: formatName(user),
      email: user.officeEmail,
      username: user.username,
      role: user.access_role,
      managerId: user.manager_id,
      isActive: user.is_active,
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

const getUserGoals = async (userId) => {
  const user = await findAnyUser(userId);
  if (!user) return null;

  const goals = await postgresDb.goal.findMany({
    where: { assignedToId: user.id },
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

const getUserTasks = async (userId) => {
  const user = await findAnyUser(userId);
  if (!user) return null;

  const tasks = await postgresDb.task.findMany({
    where: { assignedToId: user.id },
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

const getUserActivities = async (userId) => {
  const user = await findAnyUser(userId);
  if (!user) return null;

  const activities = await postgresDb.activity.findMany({
    where: { assignedToId: user.id },
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
  getAllUsers,
  findAnyUser,
  getUserProfile,
  getUserGoals,
  getUserTasks,
  getUserActivities,
};