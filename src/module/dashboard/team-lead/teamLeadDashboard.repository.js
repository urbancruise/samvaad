const { postgresDb } = require("../../../config/db");

const formatName = (u) => `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
const OPEN = { notIn: ["COMPLETED", "CANCELLED"] };

const average = (values) =>
  values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)) : 0;

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const emptyDashboard = () => ({
  overview: {
    totalEmployees: 0, activeEmployees: 0, totalGoals: 0, completedGoals: 0,
    totalTasks: 0, completedTasks: 0, overdueTasks: 0,
    totalActivities: 0, completedActivities: 0, overdueActivities: 0,
  },
  performance: { averagePerformance: 0, averageCompletion: 0, averageProductivity: 0, trend: [] },
  workload: [], topPerformers: [], needsAttention: [], activityFeed: [],
  deadlines: { overdue: [], today: [], tomorrow: [], thisWeek: [] },
});

const getDashboardOverview = async (employees) => {
  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length === 0) return emptyDashboard();

  const now = new Date();
  const mine = { in: employeeIds };

  const [
    totalGoals, completedGoals,
    totalTasks, completedTasks, overdueTasks,
    totalActivities, completedActivities, overdueActivities,
    performances, openTasks, openActivities, recentActivities, deadlineActivities,
  ] = await Promise.all([
    postgresDb.goal.count({ where: { assignedToId: mine } }),
    postgresDb.goal.count({ where: { assignedToId: mine, status: "COMPLETED" } }),
    postgresDb.task.count({ where: { assignedToId: mine } }),
    postgresDb.task.count({ where: { assignedToId: mine, status: "COMPLETED" } }),
    postgresDb.task.count({ where: { assignedToId: mine, status: OPEN, dueDate: { lt: now } } }),
    postgresDb.activity.count({ where: { assignedToId: mine } }),
    postgresDb.activity.count({ where: { assignedToId: mine, status: "COMPLETED" } }),
    postgresDb.activity.count({ where: { assignedToId: mine, status: OPEN, dueDate: { lt: now } } }),
    postgresDb.performance.findMany({
      where: { userId: mine, period: "MONTHLY" },
      orderBy: { startDate: "asc" },
    }),
    postgresDb.task.findMany({
      where: { assignedToId: mine, status: OPEN },
      select: { assignedToId: true, dueDate: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: mine, status: OPEN },
      select: { assignedToId: true, dueDate: true },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: mine },
      take: 10,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, status: true, priority: true, updatedAt: true,
        assignedToId: true, task: { select: { title: true } },
      },
    }),
    postgresDb.activity.findMany({
      where: { assignedToId: mine, status: OPEN, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      select: {
        id: true, title: true, priority: true, dueDate: true,
        assignedToId: true, task: { select: { title: true } },
      },
    }),
  ]);

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  // ---- Workload + needs attention (single pass, no O(n*m) filtering) ----
  const stats = new Map(
    employees.map((e) => [e.id, {
      employeeId: e.id, employeeName: formatName(e),
      activeTasks: 0, overdueTasks: 0, pendingActivities: 0, overdueActivities: 0,
    }])
  );
  for (const t of openTasks) {
    const s = stats.get(t.assignedToId);
    if (!s) continue;
    s.activeTasks++;
    if (t.dueDate < now) s.overdueTasks++;
  }
  for (const a of openActivities) {
    const s = stats.get(a.assignedToId);
    if (!s) continue;
    s.pendingActivities++;
    if (a.dueDate && a.dueDate < now) s.overdueActivities++;
  }
  const workload = [...stats.values()];

  const needsAttention = workload
    .filter((w) => w.overdueTasks > 0 || w.overdueActivities > 0)
    .sort((a, b) => (b.overdueTasks + b.overdueActivities) - (a.overdueTasks + a.overdueActivities))
    .slice(0, 5);

  // ---- Performance: latest MONTHLY row per employee for cards/leaderboard ----
  const latestByUser = new Map();
  for (const p of performances) latestByUser.set(p.userId, p); // rows are ascending, so last wins
  const latest = [...latestByUser.values()];

  const leaderboard = latest
    .map((p) => ({
      employeeId: p.userId,
      employeeName: formatName(employeeMap[p.userId]),
      performanceScore: p.performanceScore,
      completionRate: p.completionRate,
      productivityScore: p.productivityScore,
      completedActivities: p.completedActivities,
      completedTasks: p.completedTasks,
    }))
    .sort((a, b) => b.performanceScore - a.performanceScore);

  const topPerformers = leaderboard.slice(0, 5);

  // ---- Trend: team average per month ----
  const byMonth = new Map();
  for (const p of performances) {
    const k = monthKey(p.startDate);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(p);
  }
  const trend = [...byMonth.entries()].map(([month, rows]) => ({
    month,
    performance: average(rows.map((r) => r.performanceScore)),
    completion: average(rows.map((r) => r.completionRate)),
    productivity: average(rows.map((r) => r.productivityScore)),
  }));

  // ---- Feed + deadlines ----
  const activityFeed = recentActivities.map((a) => ({
    id: a.id,
    employee: formatName(employeeMap[a.assignedToId]),
    activity: a.title,
    task: a.task?.title ?? null,
    status: a.status,
    priority: a.priority,
    updatedAt: a.updatedAt,
  }));

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  const endOfWeek = new Date(startOfToday); endOfWeek.setDate(endOfWeek.getDate() + 7);

  const formatDeadline = (a) => ({
    id: a.id, title: a.title, employee: formatName(employeeMap[a.assignedToId]),
    task: a.task?.title ?? null, priority: a.priority, dueDate: a.dueDate,
  });

  const deadlines = {
    overdue: deadlineActivities.filter((a) => a.dueDate < startOfToday).map(formatDeadline),
    today: deadlineActivities.filter((a) => a.dueDate >= startOfToday && a.dueDate < endOfToday).map(formatDeadline),
    tomorrow: deadlineActivities.filter((a) => a.dueDate >= endOfToday && a.dueDate < endOfTomorrow).map(formatDeadline),
    thisWeek: deadlineActivities.filter((a) => a.dueDate >= endOfTomorrow && a.dueDate <= endOfWeek).map(formatDeadline),
  };

  return {
    overview: {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.is_active).length,
      totalGoals, completedGoals,
      totalTasks, completedTasks, overdueTasks,
      totalActivities, completedActivities, overdueActivities,
    },
    performance: {
      averagePerformance: average(latest.map((p) => p.performanceScore)),
      averageCompletion: average(latest.map((p) => p.completionRate)),
      averageProductivity: average(latest.map((p) => p.productivityScore)),
      trend,
    },
    workload, topPerformers, needsAttention, activityFeed, deadlines,
  };
};

module.exports = { getDashboardOverview };