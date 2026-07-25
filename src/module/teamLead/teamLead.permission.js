const ApiError = require("../../utils/ApiError");
const { isSelfOrSubordinate, normalizeRole } = require("../../utils/hierarchy.service");

const NO_SELF_ASSIGN_ROLES = ["MANAGER", "HOD"];

const canAssignToUser = async (managerId, assignedToId, managerRole) => {
  const role = normalizeRole(managerRole);
  if (NO_SELF_ASSIGN_ROLES.includes(role) && Number(managerId) === Number(assignedToId)) {
    throw new ApiError(403, `${role === "HOD" ? "HODs" : "Managers"} cannot assign work to themselves.`);
  }

  const allowed = await isSelfOrSubordinate(managerId, assignedToId, managerRole);

  if (!allowed) {
    throw new ApiError(403, "You can assign work only to yourself or your team.");
  }

  return true;
};

const canModifyResource = (resource, userId) => {
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  if (Number(resource.createdById) !== Number(userId)) {
    throw new ApiError(403, "Only the creator can edit or delete this resource.");
  }

  return true;
};


const canUpdateStatus = (resource, userId) => {
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  if (Number(resource.assignedToId) !== Number(userId)) {
    throw new ApiError(403, "Only the assignee can update the status of this item.");
  }

  return true;
};


const canManageEmployee = async (managerId, employeeId, managerRole) => {
  const role = normalizeRole(managerRole);
  if (NO_SELF_ASSIGN_ROLES.includes(role) && Number(managerId) === Number(employeeId)) {
    return false;
  }
  return isSelfOrSubordinate(managerId, employeeId, managerRole);
};

module.exports = {
  canAssignToUser,
  canModifyResource,
  canUpdateStatus,
  canManageEmployee,
};