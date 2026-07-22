const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");
const {
  getNotificationsService,
  markNotificationReadService,
  markAllNotificationsReadService,
} = require("./notification.service");

const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await getNotificationsService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, notifications, "Notifications fetched successfully")
  );
});

const markNotificationRead = asyncHandler(async (req, res) => {
  await markNotificationReadService(req.params.notificationId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, null, "Notification marked as read")
  );
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllNotificationsReadService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, null, "Notifications marked as read")
  );
});

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};