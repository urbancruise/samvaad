const ApiError = require("../../utils/ApiError");
const { postgresDb, mysqlDb } = require("../../config/db");

const ensureOwner = (activity, userId) => {
  if (activity.assignedToId !== userId) {
    throw new ApiError(403, "Access denied");
  }
};

const canManageActivity = async (user, activityId) => {
  // 1. Admins bypass permission checks
  if (user.role === "ADMIN") {
    return true;
  }

  // 2. Fetch the activity from Postgres
  const activity = await postgresDb.activity.findUnique({
    where: { id: activityId },
    select: {
      assignedToId: true,
      createdById: true,
    },
  });

  if (!activity) {
    return false;
  }

  // Check if current user is the creator OR assignee
  const isCreatorOrAssignee =
    activity.createdById === user.id || activity.assignedToId === user.id;

  // 3. Employee Role Check
  if (user.role === "EMPLOYEE") {
    return isCreatorOrAssignee;
  }

  // 4. Team Lead Role Check
  if (user.role === "TEAM_LEAD") {
    if (isCreatorOrAssignee) {
      return true;
    }

    // Check if the assigned user reports directly to this Team Lead
    if (activity.assignedToId) {
      const assignedUser = await mysqlDb.users.findUnique({
        where: { id: activity.assignedToId },
        select: {
          manager_id: true, // Matches your `users` schema
        },
      });

      return assignedUser?.manager_id === user.id;
    }

    return false;
  }

  return true;
};

const canUpdateActivityStatus = async (user, activityId) => {
  const activity = await postgresDb.activity.findUnique({
    where: { id: activityId },
    select: { assignedToId: true },
  });
 
  if (!activity) return false;
 
  return Number(activity.assignedToId) === Number(user.id);
};


module.exports = {
  ensureOwner,
  canManageActivity,
  canUpdateActivityStatus
};