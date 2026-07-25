const router = require("express").Router();

router.use("/auth", require("../module/users/user.route"));
router.use("/goals", require("../module/goals/goal.routes"));
router.use("/tasks", require("../module/tasks/task.route"));
router.use("/activity", require("../module/activities/activity.routes"));
router.use("/dashboard", require("../module/dashboard/dashboard.routes"));
router.use("/teamlead", require("../module/dashboard/team-lead/teamLeadDashboard.route"));
router.use("/calendar", require("../module/calendar/calendar.routes"));
router.use("/performance", require("../module/performance/performance.route"));
router.use("/notifications", require("../module/notifications/notification.routes"));
router.use("/team", require("../module/teamLead/teamLead.route"));
router.use("/teamlead/team", require("../module/teamLead/team/team.route"));
router.use("/manager", require("../module/manager/manager.route"));
router.use("/hod", require("../module/hod/hod.route"));
router.use("/admin", require("../module/admin/admin.route.js"));

module.exports = router;