const { postgresDb } = require("../../config/db");
const { isSelfOrSubordinate, isTopLevel, normalizeRole } = require("../../utils/hierarchy.service");

/**
 * Edit/delete rights — creator ONLY (or SUPER_ADMIN as an override).
 */
const canManageGoal = async (user, goalId) => {
  if (isTopLevel(normalizeRole(user.role))) return true;

  const goal = await postgresDb.goal.findUnique({
    where: { id: goalId },
    select: { createdById: true },
  });

  if (!goal) return false;

  return Number(goal.createdById) === Number(user.id);
};

/**
 * View rights — self, creator, or anyone in the viewer's subordinate
 * chain (a Manager can view a goal assigned to their TL's employee).
 */
const canViewGoal = async (user, goalId) => {
  if (isTopLevel(normalizeRole(user.role))) return true;

  const goal = await postgresDb.goal.findUnique({
    where: { id: goalId },
    select: { assignedToId: true, createdById: true },
  });

  if (!goal) return false;

  if (Number(goal.assignedToId) === Number(user.id) || Number(goal.createdById) === Number(user.id)) {
    return true;
  }

  return isSelfOrSubordinate(user.id, goal.assignedToId, user.role);
};

/**
 * Status/progress update — assignee ONLY, not the creator.
 */
const canUpdateGoalStatus = async (user, goalId) => {
  const goal = await postgresDb.goal.findUnique({
    where: { id: goalId },
    select: { assignedToId: true },
  });

  if (!goal) return false;

  return Number(goal.assignedToId) === Number(user.id);
};

module.exports = {
  canManageGoal,
  canViewGoal,
  canUpdateGoalStatus,
};