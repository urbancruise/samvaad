const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getEmployeeDashboard,
} = require("./dashboard.controller");

router.use(auth);

router.get(
  "/employee",
  getEmployeeDashboard
);

module.exports = router;