const { getTeamMembers, getEmployeeProfile, getEmployeeGoals, getEmployeeTasks, getEmployeeActivities, getEmployeeTimeline} = require("./team.repository");

const getTeamMembersService = async (teamLeadId) => {
  try {
    return await getTeamMembers(teamLeadId);
  } catch (error) {
    console.error(`Error in getTeamMembersService for team lead ${teamLeadId}:`, error);
    throw error;
  }
};

const getEmployeeProfileService = async (

    teamLeadId,

    employeeId

) => {

    return await getEmployeeProfile(

        teamLeadId,

        employeeId

    );

};

const getEmployeeGoalsService = async (

    teamLeadId,

    employeeId

) => {

    return await getEmployeeGoals(

        teamLeadId,

        employeeId

    );

};

const getEmployeeTasksService = async (
    teamLeadId,
    employeeId
) => {
    return await getEmployeeTasks(
        teamLeadId,
        employeeId
    );
};

const getEmployeeActivitiesService = async (

    teamLeadId,

    employeeId

) => {

    return await getEmployeeActivities(

        teamLeadId,

        employeeId

    );

};

const getEmployeeTimelineService = async (

    teamLeadId,

    employeeId

) => {

    return await getEmployeeTimeline(

        teamLeadId,

        employeeId

    );

};

module.exports = {
  getTeamMembersService,
  getEmployeeProfileService,
  getEmployeeGoalsService,
  getEmployeeTasksService,
  getEmployeeActivitiesService,
  getEmployeeTimelineService
};