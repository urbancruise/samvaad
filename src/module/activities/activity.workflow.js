const ApiError = require("../../utils/ApiError");

const WORKFLOW = {
  PENDING: [
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ],

  IN_PROGRESS: [
    "PENDING",
    "COMPLETED",
    "CANCELLED",
  ],

  COMPLETED: ["PENDING"],

  CANCELLED: ["PENDING"],
};

const validateStatusTransition = (
  currentStatus,
  nextStatus
) => {

  if (currentStatus === nextStatus) {
    return;
  }

  const allowed =
    WORKFLOW[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition from ${currentStatus} to ${nextStatus}`
    );
  }

};

module.exports = {
  validateStatusTransition,
};
