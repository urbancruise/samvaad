const { mysqlDb, postgresDb } = require("../../config/db");

const formatName = (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

/**
 * ASSUMPTION: a `departments` table exists in MySQL with at least
 * `id` and `name` columns, matching the `users.department_id` FK.
 * Adjust the model/field names below if your actual schema differs.
 */
const getAllDepartments = async () => {
  return mysqlDb.departments.findMany({
    select: { id: true, department_name: true },
    orderBy: { department_name: "asc" },
  });
};

const getDepartmentById = async (departmentId) => {
  if (!departmentId) return null;
  return mysqlDb.departments.findUnique({
    where: { id: Number(departmentId) },
    select: { id: true, department_name: true },
  });
};

// Batched version — one query for many department ids instead of one
// query PER employee inside a loop (the N+1 pattern getTeamRatingService
// used to have). Returns a Map for O(1) lookup by id.
const getDepartmentsByIds = async (departmentIds) => {
  const uniqueIds = [...new Set(departmentIds.filter(Boolean).map(Number))];
  if (uniqueIds.length === 0) return new Map();

  const departments = await mysqlDb.departments.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, department_name: true },
  });

  return new Map(departments.map((d) => [d.id, d]));
};

// Direct reports only — matches the "Self + one direct senior" rule.
const getDirectReports = async (managerId, departmentFilter) => {
  const where = { manager_id: Number(managerId) };
  if (departmentFilter) where.department_id = Number(departmentFilter);

  return mysqlDb.users.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      access_role: true,
      department_id: true,
      manager_id: true,
      is_active: true,
    },
    orderBy: { firstName: "asc" },
  });
};

// Org-wide, for SUPER_ADMIN — optionally filtered by department.
const getAllUsersForRating = async (departmentFilter) => {
  const where = {};
  if (departmentFilter) where.department_id = Number(departmentFilter);

  return mysqlDb.users.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      access_role: true,
      department_id: true,
      manager_id: true,
      is_active: true,
    },
    orderBy: { firstName: "asc" },
  });
};

const findUserWithManager = async (userId) => {
  return mysqlDb.users.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      access_role: true,
      department_id: true,
      manager_id: true,
    },
  });
};

// Both rows (SELF + SENIOR, if they exist) for one employee/period.
const getRatingRows = async (employeeId, period) => {
  return postgresDb.rating.findMany({
    where: { employeeId: Number(employeeId), period },
  });
};

// Both rows for MANY employees/one period — used by the team grid.
const getRatingRowsForTeam = async (employeeIds, period) => {
  return postgresDb.rating.findMany({
    where: { employeeId: { in: employeeIds }, period },
  });
};

const upsertRatingRow = async ({
  employeeId,
  raterId,
  raterType,
  period,
  departmentId,
  salesScore,
  conductScore,
  contributionScore,
  achievementPercent,
  extraFields,
}) => {
  return postgresDb.rating.upsert({
    where: {
      employeeId_raterType_period: {
        employeeId: Number(employeeId),
        raterType,
        period,
      },
    },
    update: {
      raterId: Number(raterId),
      departmentId: departmentId ? Number(departmentId) : null,
      salesScore,
      conductScore,
      contributionScore,
      achievementPercent,
      extraFields,
    },
    create: {
      employeeId: Number(employeeId),
      raterId: Number(raterId),
      raterType,
      period,
      departmentId: departmentId ? Number(departmentId) : null,
      salesScore,
      conductScore,
      contributionScore,
      achievementPercent,
      extraFields,
    },
  });
};

module.exports = {
  formatName,
  getAllDepartments,
  getDepartmentById,
  getDepartmentsByIds,
  getDirectReports,
  getAllUsersForRating,
  findUserWithManager,
  getRatingRows,
  getRatingRowsForTeam,
  upsertRatingRow,
};