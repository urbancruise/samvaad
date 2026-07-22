const express = require("express");

const router = express.Router();

const auth = require("../../../middlewares/auth.middleware");

const {

    getTeamMembers,
    getEmployeeProfile,
    getEmployeeGoals,
    getEmployeeTasks,
    getEmployeeActivities,
    getEmployeeTimeline

} = require("./team.controller");

router.get(

    "/",

    auth,

    getTeamMembers

);

router.get(

    "/:employeeId",

    auth,

    getEmployeeProfile

);

router.get(

    "/:employeeId/goals",

    auth,

    getEmployeeGoals

);

router.get(

    "/:employeeId/tasks",

    auth,

    getEmployeeTasks

);
router.get(

    "/:employeeId/activities",

    auth,

    getEmployeeActivities

);

router.get(

    "/:employeeId/timeline",

    auth,

    getEmployeeTimeline

);

module.exports = router;