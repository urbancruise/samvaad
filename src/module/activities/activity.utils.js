const calculateActivityProgress = (
  currentProgress,
  status
) => {

  switch (status) {

    case "PENDING":
      return 0;

    case "IN_PROGRESS":
      return currentProgress > 0
        ? currentProgress
        : 10;

    case "COMPLETED":
      return 100;

    case "CANCELLED":
      return 0;

    default:
      return currentProgress;
  }

};

module.exports = {
  calculateActivityProgress,
};
