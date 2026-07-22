const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  createActivity,
  getMyActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivityDashboard,
  getActivityCalendar,
  getActivityTimeline,
  updateActivityStatus
} = require("./activity.controller");

router.use(auth);

router.post("/", createActivity);

router.get("/dashboard", getActivityDashboard);

router.get("/calendar", getActivityCalendar);

router.get("/timeline", getActivityTimeline);

router.get("/", getMyActivities);

router.get("/:activityId", getActivityById);

router.put("/:activityId", updateActivity);

router.put("/:activityId/status", updateActivityStatus);

router.delete("/:activityId", deleteActivity);

router.patch("/:activityId/status", updateActivityStatus);

module.exports = router;