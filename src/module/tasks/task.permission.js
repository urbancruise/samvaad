const { postgresDb } = require("../../config/db");
const { isSelfOrSubordinate, isTopLevel, normalizeRole } = require("../../utils/hierarchy.service");

const canManageTask = async (user, taskId) => {
  if (isTopLevel(normalizeRole(user.role))) return true;

  const task = await postgresDb.task.findUnique({
    where: { id: taskId },
    select: { createdById: true },
  });

  if (!task) return false;

  return Number(task.createdById) === Number(user.id);
};

const canViewTask = async (user, taskId) => {
  if (isTopLevel(normalizeRole(user.role))) return true;

  const task = await postgresDb.task.findUnique({
    where: { id: taskId },
    select: { assignedToId: true, createdById: true },
  });

  if (!task) return false;

  if (Number(task.assignedToId) === Number(user.id) || Number(task.createdById) === Number(user.id)) {
    return true;
  }

  return isSelfOrSubordinate(user.id, task.assignedToId, user.role);
};

const canUpdateTaskStatus = async (user, taskId) => {
  const task = await postgresDb.task.findUnique({
    where: { id: taskId },
    select: { assignedToId: true },
  });

  if (!task) return false;

  return Number(task.assignedToId) === Number(user.id);
};

module.exports = {
  canManageTask,
  canViewTask,
  canUpdateTaskStatus,
};