const asyncHandler = require("../../../utils/asyncHandler");
const ApiResponse = require("../../../utils/ApiResponse");
const { getTeamMembersService, getEmployeeProfileService, getEmployeeGoalsService, getEmployeeTasksService, getEmployeeActivitiesService,getEmployeeTimelineService } = require("./team.service");

const getTeamMembers = asyncHandler(async (req, res) => {
  const employees = await getTeamMembersService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, employees, "Team members fetched successfully")
  );
});
const getEmployeeProfile = asyncHandler(

    async (req, res) => {

        const employee =

            await getEmployeeProfileService(

                req.user.id,

                req.params.employeeId

            );

        if (!employee) {

            return res.status(404).json(

                new ApiResponse(

                    404,

                    null,

                    "Employee not found."

                )

            );

        }

        return res.status(200).json(

            new ApiResponse(

                200,

                employee,

                "Employee profile fetched successfully."

            )

        );

    }

);

const getEmployeeGoals = asyncHandler(

    async (req, res) => {

        const goals =

            await getEmployeeGoalsService(

                req.user.id,

                req.params.employeeId

            );

        if (!goals) {

            return res.status(404).json(

                new ApiResponse(

                    404,

                    null,

                    "Employee not found."

                )

            );

        }

        return res.status(200).json(

            new ApiResponse(

                200,

                goals,

                "Employee goals fetched successfully."

            )

        );

    }

);

const getEmployeeTasks = asyncHandler(

    async (req, res) => {

        const tasks =

            await getEmployeeTasksService(

                req.user.id,

                req.params.employeeId

            );

        if (!tasks) {

            return res.status(404).json(

                new ApiResponse(

                    404,

                    null,

                    "Employee not found."

                )

            );

        }

        return res.status(200).json(

            new ApiResponse(

                200,

                tasks,

                "Employee tasks fetched successfully."

            )

        );

    }

);

const getEmployeeActivities = asyncHandler(

    async (req, res) => {

        const activities =

            await getEmployeeActivitiesService(

                req.user.id,

                req.params.employeeId

            );

        if (!activities) {

            return res.status(404).json(

                new ApiResponse(

                    404,

                    null,

                    "Employee not found."

                )

            );

        }

        return res.status(200).json(

            new ApiResponse(

                200,

                activities,

                "Employee activities fetched successfully."

            )

        );

    }

);

const getEmployeeTimeline = asyncHandler(

    async (req, res) => {

        const timeline =

            await getEmployeeTimelineService(

                req.user.id,

                req.params.employeeId

            );

        if (!timeline) {

            return res.status(404).json(

                new ApiResponse(

                    404,

                    null,

                    "Employee not found."

                )

            );

        }

        return res.status(200).json(

            new ApiResponse(

                200,

                timeline,

                "Timeline fetched successfully."

            )

        );

    }

);

module.exports = {
  getTeamMembers,
  getEmployeeProfile,
  getEmployeeGoals,
  getEmployeeTasks,
  getEmployeeActivities,
  getEmployeeTimeline
};