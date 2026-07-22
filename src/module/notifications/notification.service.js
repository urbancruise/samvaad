const {
  createNotification,
  getNotificationsByUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("./notification.repository");

const sendNotification = async ({ userId, title, message, type }) => {
  try {
    return await createNotification({
      userId,
      title,
      message,
      type,
    });
  } catch (error) {
    console.error(`Error dispatching standard notification to user ${userId}:`, error);
    throw error;
  }
};

const sendActivityUpdatedNotification = async ({ userId, activityTitle }) => {
  try {
    return await sendNotification({
      userId,
      title: "Activity Updated",
      message: `"${activityTitle}" has been updated.`,
      type: "ACTIVITY_UPDATED",
    });
  } catch (error) {
    console.error(`Error sending activity update alert to user ${userId}:`, error);
    throw error;
  }
};

const sendActivityCompletedNotification = async ({ userId, activityTitle }) => {
  try {
    return await sendNotification({
      userId,
      title: "Activity Completed",
      message: `Congratulations! "${activityTitle}" has been completed.`,
      type: "ACTIVITY_COMPLETED",
    });
  } catch (error) {
    console.error(`Error sending activity completion alert to user ${userId}:`, error);
    throw error;
  }
};

const sendTaskAssignedNotification = async ({ userId, taskTitle }) => {
  try {
    return await sendNotification({
      userId,
      title: "New Task Assigned",
      message: `You have been assigned "${taskTitle}".`,
      type: "TASK_ASSIGNED",
    });
  } catch (error) {
    console.error(`Error sending task assignment alert to user ${userId}:`, error);
    throw error;
  }
};

const sendActivityAssignedNotification = async ({ userId, activityTitle }) => {
  try {
    return await sendNotification({
      userId,
      title: "New Activity Assigned",
      message: `You have been assigned "${activityTitle}".`,
      type: "ACTIVITY_ASSIGNED",
    });
  } catch (error) {
    console.error(`Error sending activity assignment alert to user ${userId}:`, error);
    throw error;
  }
};

const getNotificationsService = async (userId) => {
  try {
    const notifications = await getNotificationsByUser(userId);
    return { notifications };
  } catch (error) {
    console.error(`Error in getNotificationsService for user ${userId}:`, error);
    throw error;
  }
};

const markNotificationReadService = async (notificationId, userId) => {
  try {
    return await markNotificationAsRead(notificationId, userId);
  } catch (error) {
    console.error(`Error in markNotificationReadService for notification ${notificationId}:`, error);
    throw error;
  }
};

const markAllNotificationsReadService = async (userId) => {
  try {
    return await markAllNotificationsAsRead(userId);
  } catch (error) {
    console.error(`Error in markAllNotificationsReadService for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  sendActivityUpdatedNotification,
  sendActivityCompletedNotification,
  sendTaskAssignedNotification,
  sendActivityAssignedNotification,
  getNotificationsService,
  markNotificationReadService,
  markAllNotificationsReadService,
};