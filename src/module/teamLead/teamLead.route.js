const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/role.middleware");

const {
    getTeamMembers,
    getTeamMember,
    getTeamPerformance,
    getTeamWorkload,
    getAssignableEmployees,
    getMyTeam
} = require("./teamLead.controller");

// NOTE: restricted to TEAM_LEAD. If HOD/MANAGER/ZONAL_HEAD/SUPER_ADMIN
// are also meant to hit these endpoints (e.g. to view a team lead's
// team), add those roles here — adjust to match your intended access
// model, this is just closing the "any logged-in user" gap.
router.use(auth, authorize("TEAM_LEAD"));

router.get(
    "/members",
    getTeamMembers
);

router.get(
    "/member/:id",
    getTeamMember
);

router.get(
    "/performance",
    getTeamPerformance
);

router.get(
    "/workload",
    getTeamWorkload
);
router.get(
    "/assignable",
    getAssignableEmployees
);

router.get(
    "/team-members",
    getMyTeam
);

module.exports = router;