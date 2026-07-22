const {
    getDashboardOverview
} = require("./teamLeadDashboard.repository");



const getTeamLeadDashboardService =
async (teamLeadId) => {

    return await getDashboardOverview(teamLeadId);

};

module.exports = {
    getTeamLeadDashboardService
};