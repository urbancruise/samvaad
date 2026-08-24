const { mysqlDb, postgresDb } = require("../../config/db");

// Shared MySQL field mapping -> shape the rest of the app expects
const mapEmployee = (u) => ({
  id: u.id,
  fullName: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
  email: u.officeEmail,
  username: u.username,
  role: u.access_role,
  isActive: u.is_active,
  // NOTE: lastLogin / createdAt kept from the original file's intent —
  // verify these column names against the actual MySQL `users` schema
  // (schema.prisma for mysql-client wasn't available when this was fixed).
  lastLogin: u.lastLogin,
  createdAt: u.createdAt,
});

const EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  officeEmail: true,
  access_role: true,
  is_active: true,
  lastLogin: true,
  createdAt: true,
};

/**
 * All direct reports of managerId, basic profile fields only.
 */
const getTeamMembers = async (managerId) => {
  try {
    const employees = await mysqlDb.users.findMany({
      where: { manager_id: managerId },
      select: EMPLOYEE_SELECT,
      orderBy: { firstName: "asc" },
    });

    return employees.map(mapEmployee);
  } catch (error) {
    console.error(`Error in getTeamMembers repository for manager ${managerId}:`, error);
    throw error;
  }
};

/**
 * A single direct report, scoped to managerId so a manager can't fetch
 * someone else's report by guessing an id.
 */
const getTeamMemberById = async (managerId, employeeId) => {
  try {
    const employee = await mysqlDb.users.findFirst({
      where: { id: Number(employeeId), manager_id: Number(managerId) },
      select: EMPLOYEE_SELECT,
    });

    return employee ? mapEmployee(employee) : null;
  } catch (error) {
    console.error(`Error in getTeamMemberById repository for manager ${managerId} and employee ${employeeId}:`, error);
    throw error;
  }
};

/**
 * MONTHLY performance rows for a set of employee ids, with basic
 * profile info hydrated from MySQL (no Prisma relation crosses DBs).
 */
const getTeamPerformance = async (employeeIds) => {
  try {
    const [performances, users] = await Promise.all([
      postgresDb.performance.findMany({
        where: { userId: { in: employeeIds }, period: "MONTHLY" },
        orderBy: { startDate: "desc" },
      }),
      mysqlDb.users.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, firstName: true, lastName: true, officeEmail: true },
      }),
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return performances.map((p) => {
      const u = userMap[p.userId];
      return {
        ...p,
        user: u
          ? {
              id: u.id,
              fullName: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
              email: u.officeEmail,
            }
          : null,
      };
    });
  } catch (error) {
    console.error("Error in getTeamPerformance repository for given employee IDs:", employeeIds, error);
    throw error;
  }
};

/**
 * Open (non-completed) goals/tasks/activities per direct report.
 */
const getTeamWorkload = async (managerId) => {
  try {
    const employees = await mysqlDb.users.findMany({
      where: { manager_id: managerId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (employees.length === 0) return [];

    const employeeIds = employees.map((e) => e.id);

    const [goals, tasks, activities] = await Promise.all([
      postgresDb.goal.findMany({
        where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
        select: { id: true, assignedToId: true },
      }),
      postgresDb.task.findMany({
        where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
        select: { id: true, assignedToId: true },
      }),
      postgresDb.activity.findMany({
        where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
        select: { id: true, assignedToId: true, dueDate: true, priority: true },
      }),
    ]);

    return employees.map((employee) => ({
      id: employee.id,
      fullName: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim(),
      assignedGoals: goals.filter((g) => g.assignedToId === employee.id),
      assignedTasks: tasks.filter((t) => t.assignedToId === employee.id),
      assignedActivities: activities.filter((a) => a.assignedToId === employee.id),
    }));
  } catch (error) {
    console.error(`Error in getTeamWorkload repository for manager ${managerId}:`, error);
    throw error;
  }
};

/**
 * Active direct reports, with open-item counts — used to power an
 * "assign to" picker (e.g. show current load before assigning more).
 */
const getAssignableEmployees = async (managerId) => {
  try {
    const employees = await mysqlDb.users.findMany({
      where: { manager_id: managerId, is_active: true },
      select: { id: true, firstName: true, lastName: true, officeEmail: true },
      orderBy: { firstName: "asc" },
    });

    if (employees.length === 0) return [];

    const employeeIds = employees.map((e) => e.id);

    const [goals, tasks, activities] = await Promise.all([
      postgresDb.goal.findMany({
        where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
        select: { id: true, assignedToId: true },
      }),
      postgresDb.task.findMany({
        where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
        select: { id: true, assignedToId: true },
      }),
      postgresDb.activity.findMany({
        where: { assignedToId: { in: employeeIds }, status: { not: "COMPLETED" } },
        select: { id: true, assignedToId: true },
      }),
    ]);

    return employees.map((employee) => ({
      id: employee.id,
      fullName: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim(),
      email: employee.officeEmail,
      assignedGoals: goals.filter((g) => g.assignedToId === employee.id),
      assignedTasks: tasks.filter((t) => t.assignedToId === employee.id),
      assignedActivities: activities.filter((a) => a.assignedToId === employee.id),
    }));
  } catch (error) {
    console.error(`Error in getAssignableEmployees repository for manager ${managerId}:`, error);
    throw error;
  }
};

/**
 * Direct reports with COMPLETED-item counts (contrast with getTeamWorkload,
 * which is open items only).
 */
const getMyTeam = async (teamLeadId) => {
  try {
    const employees = await mysqlDb.users.findMany({
      where: { manager_id: teamLeadId },
      select: EMPLOYEE_SELECT,
    });

    if (employees.length === 0) return [];

    const employeeIds = employees.map((e) => e.id);

    const [goals, tasks, activities] = await Promise.all([
      postgresDb.goal.findMany({
        where: { assignedToId: { in: employeeIds }, status: "COMPLETED" },
        select: { id: true, assignedToId: true },
      }),
      postgresDb.task.findMany({
        where: { assignedToId: { in: employeeIds }, status: "COMPLETED" },
        select: { id: true, assignedToId: true },
      }),
      postgresDb.activity.findMany({
        where: { assignedToId: { in: employeeIds }, status: "COMPLETED" },
        select: { id: true, assignedToId: true },
      }),
    ]);

    return employees.map((employee) => ({
      ...mapEmployee(employee),
      assignedGoals: goals.filter((g) => g.assignedToId === employee.id),
      assignedTasks: tasks.filter((t) => t.assignedToId === employee.id),
      assignedActivities: activities.filter((a) => a.assignedToId === employee.id),
    }));
  } catch (error) {
    console.error(`Error in getMyTeam repository for team lead ${teamLeadId}:`, error);
    throw error;
  }
};

module.exports = {
  getTeamMembers,
  getTeamMemberById,
  getTeamPerformance,
  getTeamWorkload,
  getAssignableEmployees,
  getMyTeam,
};