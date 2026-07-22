const calculatePerformance = (activities) => {

  const total = activities.length;

  if (!total) {
    return {
      completionRate: 0,
      productivityScore: 0,
      efficiencyScore: 0,
      delayRate: 0,
      performanceScore: 0,
    };
  }

  let completed = 0;
  let delayed = 0;

  let estimated = 0;
  let actual = 0;

  activities.forEach(activity => {

    estimated += activity.estimatedMinutes || 0;
    actual += activity.actualMinutes || 0;

    if (activity.status === "COMPLETED") {

      completed++;

      if (
        activity.completedAt &&
        activity.dueDate &&
        activity.completedAt > activity.dueDate
      ) {
        delayed++;
      }

    }

  });

  const completionRate =
    Math.round((completed / total) * 100);

  const delayRate =
    completed
      ? Math.round((delayed / completed) * 100)
      : 0;

  const efficiencyScore =
    estimated > 0
      ? Math.round(
          Math.min((estimated / Math.max(actual, 1)) * 100, 100)
        )
      : 100;

  const productivityScore = Math.round(
    (completionRate + efficiencyScore) / 2
  );

  const performanceScore = Math.round(
    (
      completionRate * 0.4 +
      efficiencyScore * 0.4 +
      (100 - delayRate) * 0.2
    )
  );

  return {
    completionRate,
    productivityScore,
    efficiencyScore,
    delayRate,
    performanceScore,
  };

};

module.exports = {
  calculatePerformance,
};