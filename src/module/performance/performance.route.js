const express = require("express");

const router = express.Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getPerformanceDashboard,
  getAchievements,
  getPerformanceAnalytics
} = require("./performance.controller");

router.get(
  "/dashboard",
  auth,
  getPerformanceDashboard
);

router.get(
    "/achievements",
    auth,
    getAchievements
);

router.get(
    "/analytics",
    auth,
    getPerformanceAnalytics
);


module.exports = router;