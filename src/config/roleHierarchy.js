// config/roleHierarchy.js

const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HOD: "HOD",
  ZONAL_HEAD: "ZONAL_HEAD", // treated identically to HOD
  MANAGER: "MANAGER",
  TEAM_LEAD: "TEAM_LEAD",
  EMPLOYEE: "EMPLOYEE",
};

// lower number = higher authority
const ROLE_LEVEL = {
  SUPER_ADMIN: 1,
  HOD: 2,
  ZONAL_HEAD: 2, // same level as HOD
  MANAGER: 3,
  TEAM_LEAD: 4,
  EMPLOYEE: 5,
};

// who is allowed to assign tasks to whom (by level relationship)
function canAssignTask(assignerRole, assigneeRole) {
  const assignerLevel = ROLE_LEVEL[assignerRole];
  const assigneeLevel = ROLE_LEVEL[assigneeRole];
  if (assignerLevel === undefined || assigneeLevel === undefined) return false;

  if (assignerRole === ROLES.SUPER_ADMIN) return true; // admin can assign to anyone

  // everyone else can only assign one level down
  return assigneeLevel === assignerLevel + 1;
}

function isAtLeast(role, minRole) {
  return ROLE_LEVEL[role] <= ROLE_LEVEL[minRole];
}

module.exports = { ROLES, ROLE_LEVEL, canAssignTask, isAtLeast };