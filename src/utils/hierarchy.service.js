const { mysqlDb } = require("../config/db");

// Roles that bypass all hierarchy checks entirely
const TOP_LEVEL_ROLES = ["SUPER_ADMIN"];

const normalizeRole = (role) => {
  // ZONAL_HEAD is treated identically to HOD everywhere in the app
  if (role === "ZONAL_HEAD") return "HOD";
  return role;
};

const isTopLevel = (role) => TOP_LEVEL_ROLES.includes(role);

/**
 * Returns the full set of employee ids that report — directly or
 * transitively — up to `userId`. Walks the MySQL manager_id chain
 * breadth-first. Does NOT include userId itself.
 */
const getSubordinateIds = async (userId) => {
  const subordinateIds = new Set();
  let frontier = [Number(userId)];

  while (frontier.length > 0) {
    const directReports = await mysqlDb.users.findMany({
      where: { manager_id: { in: frontier } },
      select: { id: true },
    });

    const newIds = directReports.map((u) => u.id).filter((id) => !subordinateIds.has(id));
    if (newIds.length === 0) break;

    newIds.forEach((id) => subordinateIds.add(id));
    frontier = newIds;
  }

  return subordinateIds;
};

/**
 * True if targetId is userId themself, or anywhere in userId's
 * subordinate chain, or userId holds a top-level role.
 */
const isSelfOrSubordinate = async (userId, targetId, userRole) => {
  if (isTopLevel(normalizeRole(userRole))) return true;
  if (Number(userId) === Number(targetId)) return true;

  const subordinateIds = await getSubordinateIds(userId);
  return subordinateIds.has(Number(targetId));
};

module.exports = {
  normalizeRole,
  isTopLevel,
  getSubordinateIds,
  isSelfOrSubordinate,
};