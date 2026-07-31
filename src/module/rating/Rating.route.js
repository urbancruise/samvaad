const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getDepartments,
  getFieldConfig,
  getEmployeeRating,
  getMyRating,
  getTeamRating,
  submitSelfRating,
  submitSeniorRating,
} = require("./rating.controller");

router.use(auth);

router.get("/departments", getDepartments);
router.get("/field-config", getFieldConfig);

router.get("/me", getMyRating);
router.get("/team", getTeamRating);

router.get("/:employeeId", getEmployeeRating);
router.put("/:employeeId/self", submitSelfRating);
router.put("/:employeeId/senior", submitSeniorRating);

module.exports = router;