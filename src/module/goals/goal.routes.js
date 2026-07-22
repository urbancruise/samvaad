const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");
const {
  createGoal,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  getTodayGoals
} = require("./goal.controller");

router.use(auth)
router.post("/", createGoal);

router.get("/", getMyGoals);

router.get("/today", getTodayGoals);
router.get("/:goalId", getGoalById);

router.put("/:goalId", updateGoal);

router.delete("/:goalId", deleteGoal);


module.exports = router;