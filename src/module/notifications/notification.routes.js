const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("./notification.controller");

router.use(auth);

router.get("/", getNotifications);

router.put("/read-all", markAllNotificationsRead);

router.put("/:notificationId/read", markNotificationRead);

module.exports = router;
