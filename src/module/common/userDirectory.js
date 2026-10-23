const { mysqlDb, postgresDb } = require("../../config/db");

const formatName = (u) => `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();

const USER_SELECT = {
  id: true, firstName: true, lastName: true, username: true, officeEmail: true,
  access_role: true, manager_id: true, is_active: true,
  departments: { select: { id: true, department_name: true } },
  // self-relation = the reporting manager, plus the manager's own department
  users: {
    select: {
      id: true, firstName: true, lastName: true,
      departments: { select: { department_name: true } },
    },
  },
};

const parsePaging = (q) => {
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 12, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const buildFilters = (q) => {
  const and = [];

  if (q.role && q.role !== "ALL") {
    and.push({ access_role: q.role === "HOD" ? { in: ["HOD", "ZONAL_HEAD"] } : q.role });
  }

  const deptId = Number(q.departmentId);
  if (q.departmentId && !Number.isNaN(deptId)) and.push({ department_id: deptId });

  // Every word must match somewhere, so "rahul ver" finds "Rahul Verma"
  const terms = String(q.search || "").trim().split(/\s+/).filter(Boolean);
  for (const t of terms) {
    and.push({
      OR: [
        { firstName: { contains: t } },
        { middleName: { contains: t } },
        { lastName: { contains: t } },
        { username: { contains: t } },
        { officeEmail: { contains: t } },
        { employeeId: { contains: t } },
      ],
    });
  }
  return and;
};

const attachStats = async (users) => {
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const now = new Date();
  const mine = { in: ids };

  const [goals, tasks, activities, performances] = await Promise.all([
    postgresDb.goal.findMany({ where: { assignedToId: mine }, select: { assignedToId: true, status: true } }),
    postgresDb.task.findMany({ where: { assignedToId: mine }, select: { assignedToId: true, status: true } }),
    postgresDb.activity.findMany({ where: { assignedToId: mine }, select: { assignedToId: true, status: true, dueDate: true } }),
    postgresDb.performance.findMany({ where: { userId: mine, period: "MONTHLY" }, orderBy: { startDate: "desc" } }),
  ]);

  const groupBy = (rows) => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.assignedToId)) m.set(r.assignedToId, []);
      m.get(r.assignedToId).push(r);
    }
    return m;
  };
  const g = groupBy(goals), t = groupBy(tasks), a = groupBy(activities);
  const latestPerf = new Map();
  for (const p of performances) if (!latestPerf.has(p.userId)) latestPerf.set(p.userId, p); // desc order, first = latest

  return users.map((u) => {
    const uG = g.get(u.id) ?? [], uT = t.get(u.id) ?? [], uA = a.get(u.id) ?? [];
    return {
      id: u.id,
      fullName: formatName(u),
      email: u.officeEmail,
      username: u.username,
      role: u.access_role,
      managerId: u.manager_id,
      isActive: u.is_active,
      departmentId: u.departments?.id ?? null,
      departmentName: u.departments?.department_name ?? null,
      manager: u.users
        ? { id: u.users.id, fullName: formatName(u.users), departmentName: u.users.departments?.department_name ?? null }
        : null,
      performanceScore: latestPerf.get(u.id)?.performanceScore ?? 0,
      totalGoals: uG.length,
      completedGoals: uG.filter((x) => x.status === "COMPLETED").length,
      totalTasks: uT.length,
      completedTasks: uT.filter((x) => x.status === "COMPLETED").length,
      totalActivities: uA.length,
      completedActivities: uA.filter((x) => x.status === "COMPLETED").length,
      overdueActivities: uA.filter((x) => x.status !== "COMPLETED" && x.status !== "CANCELLED" && x.dueDate && x.dueDate < now).length,
    };
  });
};

/**
 * scopeWhere = who this viewer is allowed to see.
 *   admin        -> {}
 *   other seniors -> { id: { in: [...subordinateIds] } }
 */
const listUsers = async (scopeWhere, query = {}) => {
  const { page, limit, skip } = parsePaging(query);
  const where = { AND: [scopeWhere, ...buildFilters(query)] };

  const [total, users] = await Promise.all([
    mysqlDb.users.count({ where }),
    mysqlDb.users.findMany({
      where, select: USER_SELECT,
      orderBy: [{ firstName: "asc" }, { id: "asc" }],
      skip, take: limit,
    }),
  ]);

  return {
    items: await attachStats(users),
    total, page, limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

// Dropdown options. Admin gets every department; others get only departments present in their scope.
const getDepartmentOptions = async (scopeWhere = {}) => {
  if (Object.keys(scopeWhere).length === 0) {
    const rows = await mysqlDb.departments.findMany({
      where: { is_active: true },
      select: { id: true, department_name: true },
      orderBy: { department_name: "asc" },
    });
    return rows.map((d) => ({ id: d.id, name: d.department_name }));
  }
  const rows = await mysqlDb.users.findMany({
    where: { AND: [scopeWhere, { department_id: { not: null } }] },
    distinct: ["department_id"],
    select: { departments: { select: { id: true, department_name: true } } },
  });
  return rows
    .map((r) => r.departments)
    .filter(Boolean)
    .map((d) => ({ id: d.id, name: d.department_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

module.exports = { listUsers, getDepartmentOptions };