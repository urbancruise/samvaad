const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {

    getTeamMembers,
    getTeamMember,
    getTeamPerformance,
    getTeamWorkload,
    getAssignableEmployees,
    getMyTeam
} = require("./teamLead.controller");

router.get(
    "/members",
    auth,
    getTeamMembers
);

router.get(
    "/member/:id",
    auth,
    getTeamMember
);

router.get(
    "/performance",
    auth,
    getTeamPerformance
);

router.get(
    "/workload",
    auth,
    getTeamWorkload
);
router.get(
    "/assignable",
    auth,
    getAssignableEmployees
);

router.get(
    "/team-members",
    auth,
    getMyTeam
);



module.exports = router;