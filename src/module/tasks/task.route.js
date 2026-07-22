const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  createTask,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskDashboard,
  getCalendarTasks,
  getTaskTimeline,
} = require("./task.controller");

router.use(auth);

router.post("/", createTask);

router.get("/dashboard", getTaskDashboard);

router.get("/calendar", getCalendarTasks);

router.get("/timeline", getTaskTimeline);

router.get("/", getMyTasks);

router.get("/:taskId", getTaskById);

router.put("/:taskId", updateTask);

router.patch("/:taskId/status", updateTaskStatus);

router.delete("/:taskId", deleteTask);

module.exports = router;