const ApiError = require("../../utils/ApiError");
const { isSelfOrSubordinate } = require("../../utils/hierarchy.service");

/**
 * Can `managerId` assign work to `assignedToId`?
 * True for self-assignment, or anyone in managerId's subordinate chain.
 */
const canAssignToUser = async (managerId, assignedToId, managerRole) => {
  const allowed = await isSelfOrSubordinate(managerId, assignedToId, managerRole);

  if (!allowed) {
    throw new ApiError(403, "You can assign work only to yourself or your team.");
  }

  return true;
};

/**
 * Full edit/delete rights — creator ONLY, no exceptions.
 * Assignees use a separate status-update path (see canUpdateStatus).
 */
const canModifyResource = (resource, userId) => {
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

 if (
    Number(resource.createdById) !== Number(userId) &&
    Number(resource.assignedToId) !== Number(userId)
  ) {
    throw new ApiError(403, "Only the creator can edit or delete this resource.");
  }

  return true;
};

/**
 * Status/progress updates — assignee ONLY. The creator does NOT
 * automatically get this right (they use canModifyResource instead).
 */
const canUpdateStatus = (resource, userId) => {
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  if (
    Number(resource.createdById) !== Number(userId) &&
    Number(resource.assignedToId) !== Number(userId)
  ) {
    throw new ApiError(
      403,
      "Only the creator or assignee can update the status."
    );
  }

  return true;
};

/**
 * Can managerId view/manage employeeId's data at all (dashboards,
 * profile pages, listing their goals/tasks)? Self or anyone in the
 * subordinate chain.
 */
const canManageEmployee = async (managerId, employeeId, managerRole) => {
  return isSelfOrSubordinate(managerId, employeeId, managerRole);
};

module.exports = {
  canAssignToUser,
  canModifyResource,
  canUpdateStatus,
  canManageEmployee,
};