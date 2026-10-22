const { mysqlDb } = require("../../../config/db");
const ApiError = require("../../../utils/ApiError");
const { normalizeRole, getSubordinateIds } = require("../../../utils/hierarchy.service");
const { getDashboardOverview } = require("./teamLeadDashboard.repository");

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, is_active: true };

const isAdminRole = (role) => role === "SUPER_ADMIN" || role === "ADMIN";

const resolveScope = async (viewer, targetId) => {
  // ASSUMPTION: the JWT carries the role as `role` or `access_role`. Adjust if different.
  const role = normalizeRole(viewer.role ?? viewer.access_role);

  // Opening a specific team lead's profile -> that lead's team only
  if (targetId) {
    if (!isAdminRole(role) && Number(viewer.id) !== targetId) {
      const mine = await getSubordinateIds(viewer.id);
      if (!mine.has(targetId)) throw new ApiError(403, "You cannot view this team");
    }
    const ids = [...(await getSubordinateIds(targetId))];
    return mysqlDb.users.findMany({ where: { id: { in: ids } }, select: EMPLOYEE_SELECT });
  }

  // Admin / Super Admin -> everyone
  if (isAdminRole(role)) {
    return mysqlDb.users.findMany({ where: { id: { not: Number(viewer.id) } }, select: EMPLOYEE_SELECT });
  }

  // Everyone else -> their own team (direct + indirect reports)
  const ids = [...(await getSubordinateIds(viewer.id))];
  return mysqlDb.users.findMany({ where: { id: { in: ids } }, select: EMPLOYEE_SELECT });
};

const getTeamLeadDashboardService = async (viewer, targetId = null) => {
  const employees = await resolveScope(viewer, targetId);
  return getDashboardOverview(employees);
};

module.exports = { getTeamLeadDashboardService };