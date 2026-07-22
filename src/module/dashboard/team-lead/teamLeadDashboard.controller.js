const asyncHandler = require("../../../utils/asyncHandler");
const ApiResponse = require("../../../utils/ApiResponse");

const {
    getTeamLeadDashboardService
} = require("./teamLeadDashboard.service");

const getTeamLeadDashboard = asyncHandler(
    async (req, res) => {

        const dashboard =
            await getTeamLeadDashboardService(
                req.user.id
            );

        return res.status(200).json(

            new ApiResponse(
                200,
                dashboard,
                "Team Lead dashboard fetched successfully"
            )

        );

    }
);

module.exports = {
    getTeamLeadDashboard
};