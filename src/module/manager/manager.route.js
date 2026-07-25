const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getMyTeamLeads,
  getTeamLeadProfile,
  getTeamLeadGoals,
  getTeamLeadTasks,
  getTeamLeadActivities,
} = require("./manager.controller");

router.use(auth);

router.get("/team", getMyTeamLeads);
router.get("/team/:tlId", getTeamLeadProfile);
router.get("/team/:tlId/goals", getTeamLeadGoals);
router.get("/team/:tlId/tasks", getTeamLeadTasks);
router.get("/team/:tlId/activities", getTeamLeadActivities);

module.exports = router;