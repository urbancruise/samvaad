const { postgresDb } = require("../../config/db");

const createNotification = async (data) => {
  try {
    return await postgresDb.notification.create({
      data,
    });
  } catch (error) {
    console.error("Error creating notification in repository:", error);
    throw error;
  }
};

const getNotificationsByUser = async (userId) => {
  try {
    return await postgresDb.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error(`Error fetching notifications for user ${userId} in repository:`, error);
    throw error;
  }
};

const markNotificationAsRead = async (notificationId, userId) => {
  try {
    return await postgresDb.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  } catch (error) {
    console.error(`Error marking notification ID ${notificationId} as read in repository:`, error);
    throw error;
  }
};

const markAllNotificationsAsRead = async (userId) => {
  try {
    return await postgresDb.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  } catch (error) {
    console.error(`Error marking all notifications as read for user ${userId} in repository:`, error);
    throw error;
  }
};

module.exports = {
  createNotification,
  getNotificationsByUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};