const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");
const ApiError = require("../../utils/ApiError");

const {
  getAllUsers,
  getUserProfile,
  getUserGoals,
  getUserTasks,
  getUserActivities,
} = require("./admin.controller");

/**
 * CRITICAL: every other module (teamLead/manager/hod) is implicitly
 * scoped by the manager_id hierarchy walk — a Manager hitting another
 * team's TL profile just gets a 404, no explicit role check needed.
 * Admin's queries have NO such scoping (that's the point — org-wide
 * access). Without this gate, any authenticated user could reach every
 * user's data by hitting these routes directly.
 */
const requireSuperAdmin = (req, res, next) => {
  const role = req.user?.role === "ZONAL_HEAD" ? "HOD" : req.user?.role;
  if (role !== "SUPER_ADMIN") {
    return next(new ApiError(403, "This section is restricted to Super Admins."));
  }
  next();
};

router.use(auth, requireSuperAdmin);

router.get("/team", getAllUsers);
router.get("/team/:userId", getUserProfile);
router.get("/team/:userId/goals", getUserGoals);
router.get("/team/:userId/tasks", getUserTasks);
router.get("/team/:userId/activities", getUserActivities);

module.exports = router;