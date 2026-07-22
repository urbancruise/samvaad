const express = require("express");

const router = express.Router();

const auth = require("../../../middlewares/auth.middleware");

const {
    getTeamLeadDashboard
} = require("./teamLeadDashboard.controller");

router.get(
    "/dashboard",
    auth,
    getTeamLeadDashboard
);

module.exports = router;