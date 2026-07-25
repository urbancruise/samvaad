const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getMyManagers,
  getManagerProfile,
  getManagerGoals,
  getManagerTasks,
  getManagerActivities,
} = require("./hod.controller");

router.use(auth);

router.get("/team", getMyManagers);
router.get("/team/:managerId", getManagerProfile);
router.get("/team/:managerId/goals", getManagerGoals);
router.get("/team/:managerId/tasks", getManagerTasks);
router.get("/team/:managerId/activities", getManagerActivities);

module.exports = router;