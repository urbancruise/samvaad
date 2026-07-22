const { mysqlDb, postgresDb } = require("../../../config/db");

const formatName = (u) => `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();

const getDashboardOverview = async (teamLeadId) => {
  // Step 1: hierarchy — who reports to this team lead — lives in MySQL
  const employees = await mysqlDb.users.findMany({
    where: { manager_id: teamLeadId },
    select: { id: true, firstName: true, lastName: true, is_active: true },
  });

  const employeeIds = employees.map((employee) => employee.id);
  const now = new Date();

  if (employeeIds.length === 0) {
    return {
      overview: {
        totalEmployees: 0,
        activeEmployees: 0,
        totalGoals: 0,
        completedGoals: 0,
        totalTasks: 0,
        completedTasks: 0,
        totalActivities: 0,
        completedActivities: 0,
        overdueActivities: 0,
      },
      performance: { averagePerformance: 0, averageCompletion: 0, averageProductivity: 0 },
      workload: [],
      topPerformers: [],
      needsAttention: [],
      activityFeed: [],
      deadlines: { overdue: [], today: [], tomorrow: [], thisWeek: [] },
    };
  }

  // Step 2: all app-data stats live in Postgres, filtered by employeeIds
  const [
    totalGoals,
    completedGoals,
    totalTasks,
    completedTasks,
    totalActivities,
    completedActivities,
    overdueActivities,
    performances,
    tasksForWorkload,
    activitiesForWorkload,
    recentActivities,
    deadlineActivities,
  ] = await Promise.all([
    postgresDb.goal.count({ where: { assignedToId: { in: employeeIds } } }),
    postgresDb.goal.count({ where: { assignedToId: { in: employeeIds }, status: "COMPLETED" } }),
    postgresDb.task.count({ where: { assignedToId: { in: employeeIds } } }),
    postgresDb.task.count({ where: { assignedToId: { in: employeeIds }, status: "COMPLETED" } }),
    postgresDb.activity.count({ where: { assignedToId: { in: employeeIds } } }),
    postgresDb.activity.count({ where: { assignedToId: { in: employeeIds }, status: "COMPLETED" } }),
    postgresDb.activity.count({
      where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" }, dueDate: { lt: now } },
    }),
    postgresDb.performance.findMany({
      where: { userId: { in: employeeIds }, period: "MONTHLY" },
    }),
    postgresDb.task.findMany({
      where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
      select: { id: true, assignedToId: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: { in: employeeIds } },
      select: { assignedToId: true, status: true, dueDate: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: { in: employeeIds } },
      take: 10,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        assignedToId: true,
        task: { select: { title: true } },
      },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        assignedToId: true,
        task: { select: { title: true } },
      },
    }),
  ]);

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const average = (values) => {
    if (!values.length) return 0;
    return Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2));
  };

  // Workload per employee
  const workload = employees.map((employee) => {
    const activeTasks = tasksForWorkload.filter((t) => t.assignedToId === employee.id).length;
    const empActivities = activitiesForWorkload.filter((a) => a.assignedToId === employee.id);
    const pendingActivities = empActivities.filter((a) => a.status !== "COMPLETED").length;
    const overdue = empActivities.filter(
      (a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now
    ).length;

    return {
      employeeId: employee.id,
      employeeName: formatName(employee),
      activeTasks,
      pendingActivities,
      overdueActivities: overdue,
    };
  });

  // Leaderboard
  const leaderboard = performances
    .map((item) => ({
      employeeId: item.userId,
      employeeName: formatName(employeeMap[item.userId]),
      performanceScore: item.performanceScore,
      completionRate: item.completionRate,
      productivityScore: item.productivityScore,
      completedActivities: item.completedActivities,
      completedTasks: item.completedTasks,
    }))
    .sort((a, b) => b.performanceScore - a.performanceScore);

  const topPerformers = leaderboard.slice(0, 5);
  const needsAttention = [...leaderboard].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, 5);

  // Activity feed
  const activityFeed = recentActivities.map((activity) => ({
    id: activity.id,
    employee: formatName(employeeMap[activity.assignedToId]),
    activity: activity.title,
    task: activity.task?.title ?? null,
    status: activity.status,
    priority: activity.priority,
    updatedAt: activity.updatedAt,
  }));

  // Deadlines
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const formatDeadline = (activity) => ({
    id: activity.id,
    title: activity.title,
    employee: formatName(employeeMap[activity.assignedToId]),
    task: activity.task?.title ?? null,
    priority: activity.priority,
    dueDate: activity.dueDate,
  });

  const deadlines = {
    overdue: deadlineActivities.filter((a) => a.dueDate < startOfToday).map(formatDeadline),
    today: deadlineActivities
      .filter((a) => a.dueDate >= startOfToday && a.dueDate < endOfToday)
      .map(formatDeadline),
    tomorrow: deadlineActivities
      .filter((a) => a.dueDate >= endOfToday && a.dueDate < endOfTomorrow)
      .map(formatDeadline),
    thisWeek: deadlineActivities
      .filter((a) => a.dueDate >= endOfTomorrow && a.dueDate <= endOfWeek)
      .map(formatDeadline),
  };

  return {
    overview: {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.is_active).length,
      totalGoals,
      completedGoals,
      totalTasks,
      completedTasks,
      totalActivities,
      completedActivities,
      overdueActivities,
    },
    performance: {
      averagePerformance: average(performances.map((p) => p.performanceScore)),
      averageCompletion: average(performances.map((p) => p.completionRate)),
      averageProductivity: average(performances.map((p) => p.productivityScore)),
    },
    workload,
    topPerformers,
    needsAttention,
    activityFeed,
    deadlines,
  };
};

const getTeamPerformanceTrend = async (employeeIds) => {
  return postgresDb.performance.findMany({
    where: { userId: { in: employeeIds }, period: "MONTHLY" },
    orderBy: { startDate: "asc" },
    select: {
      userId: true,
      startDate: true,
      performanceScore: true,
      completionRate: true,
      productivityScore: true,
    },
  });
};

module.exports = {
  getDashboardOverview,
  getTeamPerformanceTrend,
};