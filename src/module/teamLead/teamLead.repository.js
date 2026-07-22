const { mysqlDb, postgresDb } = require("../../../config/db");

const getTeamMembers = async (teamLeadId) => {
  try {
    // Step 1: hierarchy lookup — who reports to this team lead — lives in MySQL
    const employees = await mysqlDb.users.findMany({
      where: { manager_id: teamLeadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        officeEmail: true,
        is_active: true,
      },
    });

    if (employees.length === 0) return [];

    const employeeIds = employees.map((e) => e.id);
    const now = new Date();

    const [goals, tasks, activities, performances] = await Promise.all([
      postgresDb.goal.findMany({
        where: { assignedToId: { in: employeeIds } },
        select: { assignedToId: true, status: true },
      }),
      postgresDb.task.findMany({
        where: { assignedToId: { in: employeeIds } },
        select: { assignedToId: true, status: true },
      }),
      postgresDb.activity.findMany({
        where: { assignedToId: { in: employeeIds } },
        select: { assignedToId: true, status: true, dueDate: true },
      }),
      postgresDb.performance.findMany({
        where: { userId: { in: employeeIds }, period: "MONTHLY" },
        orderBy: { startDate: "desc" },
      }),
    ]);

    // Step 3: merge in JS, keyed by employee id
    return employees.map((employee) => {
      const empGoals = goals.filter((g) => g.assignedToId === employee.id);
      const empTasks = tasks.filter((t) => t.assignedToId === employee.id);
      const empActivities = activities.filter((a) => a.assignedToId === employee.id);
      const performance = performances.find((p) => p.userId === employee.id);

      const totalGoals = empGoals.length;
      const completedGoals = empGoals.filter((g) => g.status === "COMPLETED").length;

      const totalTasks = empTasks.length;
      const completedTasks = empTasks.filter((t) => t.status === "COMPLETED").length;

      const totalActivities = empActivities.length;
      const completedActivities = empActivities.filter((a) => a.status === "COMPLETED").length;
      const pendingActivities = empActivities.filter((a) => a.status !== "COMPLETED").length;

      const overdueActivities = empActivities.filter(
        (a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now
      ).length;

      return {
        id: employee.id,
        fullName: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim(),
        email: employee.officeEmail,
        username: employee.username,
        isActive: employee.is_active,
        performanceScore: performance?.performanceScore ?? 0,
        totalGoals,
        completedGoals,
        totalTasks,
        completedTasks,
        totalActivities,
        completedActivities,
        pendingActivities,
        overdueActivities,
      };
    });
  } catch (error) {
    console.error(`Error in getTeamMembers repository for team lead ${teamLeadId}:`, error);
    throw error;
  }
};

// Shared helper: confirms employeeId actually reports to teamLeadId, via MySQL
const findManagedEmployee = async (teamLeadId, employeeId) => {
  return mysqlDb.users.findFirst({
    where: { id: Number(employeeId), manager_id: Number(teamLeadId) },
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

const getEmployeeProfile = async (teamLeadId, employeeId) => {
  const employee = await findManagedEmployee(teamLeadId, employeeId);
  if (!employee) return null;

  const now = new Date();
  const id = employee.id;

  const [
    totalGoals,
    completedGoals,
    totalTasks,
    completedTasks,
    totalActivities,
    completedActivities,
    pendingActivities,
    overdueActivities,
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
      id: employee.id,
      fullName: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim(),
      email: employee.officeEmail,
      username: employee.username,
      role: employee.access_role,
      isActive: employee.is_active,
    },
    overview: {
      totalGoals,
      completedGoals,
      totalTasks,
      completedTasks,
      totalActivities,
      completedActivities,
      pendingActivities,
      overdueActivities,
    },
    performance: {
      performanceScore: performance?.performanceScore ?? 0,
      completionRate: performance?.completionRate ?? 0,
      productivityScore: performance?.productivityScore ?? 0,
    },
  };
};

/**
 * NOTE: createdById/assignedToId are now included below. The frontend
 * uses these to decide whether the logged-in TL is allowed to see
 * Edit/Delete actions on a given goal — items created by the employee
 * themself (or by a different manager) should NOT show those actions.
 */
const getEmployeeGoals = async (teamLeadId, employeeId) => {
  const employee = await findManagedEmployee(teamLeadId, employeeId);
  if (!employee) return null;

  const goals = await postgresDb.goal.findMany({
    where: { assignedToId: employee.id },
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

const getEmployeeTasks = async (teamLeadId, employeeId) => {
  const employee = await findManagedEmployee(teamLeadId, employeeId);
  if (!employee) return null;

  const tasks = await postgresDb.task.findMany({
    where: { assignedToId: employee.id },
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

const getEmployeeActivities = async (teamLeadId, employeeId) => {
  const employee = await findManagedEmployee(teamLeadId, employeeId);
  if (!employee) return null;

  const activities = await postgresDb.activity.findMany({
    where: { assignedToId: employee.id },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          goal: { select: { id: true, title: true } },
        },
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

const getEmployeeTimeline = async (teamLeadId, employeeId) => {
  const employee = await findManagedEmployee(teamLeadId, employeeId);
  if (!employee) return null;

  const history = await postgresDb.activityHistory.findMany({
    where: { activity: { assignedToId: employee.id } },
    include: {
      activity: {
        select: {
          id: true,
          title: true,
          task: { select: { title: true, goal: { select: { title: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // userId on ActivityHistory is a MySQL id with no relation, so batch-hydrate names
  const userIds = [...new Set(history.map((h) => h.userId))];
  const users = userIds.length
    ? await mysqlDb.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const userMap = Object.fromEntries(
    users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()])
  );

  return history.map((h) => ({
    ...h,
    user: { id: h.userId, fullName: userMap[h.userId] ?? "Unknown" },
  }));
};

module.exports = {
  getTeamMembers,
  getEmployeeProfile,
  getEmployeeGoals,
  getEmployeeTasks,
  getEmployeeActivities,
  getEmployeeTimeline,
};