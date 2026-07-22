const buildTimeline = (activities) => {

  return activities.map(activity => {

    let action = "Activity Updated";
    let time = activity.updatedAt;

    if (activity.status === "COMPLETED") {
      action = "Activity Completed";
      time = activity.completedAt || activity.updatedAt;
    }

    return {
      id: activity.id,
      title: activity.title,
      action,
      time,
      status: activity.status,
    };

  });

};

module.exports = {
  buildTimeline,
};