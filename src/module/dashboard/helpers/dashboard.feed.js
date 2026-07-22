const buildRecentActivities = (activities) => {

  return activities.map(activity => ({

    id: activity.id,

    title: activity.title,

    task: activity.task?.title || null,

    status: activity.status,

    priority: activity.priority,

    progress: activity.progress,

    updatedAt: activity.updatedAt,

  }));

};

module.exports = {
  buildRecentActivities,
};