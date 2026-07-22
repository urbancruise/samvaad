const { postgresDb } = require("../../../config/db");
const ApiError = require("../../../utils/ApiError");

const getUser = async (userId) => {

    return postgresDb.user.findUnique({

        where: {
            id: userId
        }

    });

};

const canAssignUser = async (
    currentUserId,
    assignedToId
) => {

    const currentUser = await getUser(currentUserId);

    if (!currentUser) {
        throw new ApiError(404, "User not found");
    }

    // Admin can assign anyone
    if (currentUser.role === "ADMIN") {
        return true;
    }

    // Manager / Team Lead can assign themselves
    if (currentUserId === assignedToId) {
        return true;
    }

    const assignedUser = await getUser(assignedToId);

    if (!assignedUser) {
        throw new ApiError(404, "Assigned user not found");
    }

    switch (currentUser.role) {

        case "MANAGER":

            if (
                assignedUser.managerId === currentUserId &&
                assignedUser.role === "TEAM_LEAD"
            ) {
                return true;
            }

            break;

        case "TEAM_LEAD":

            if (
                assignedUser.managerId === currentUserId &&
                assignedUser.role === "EMPLOYEE"
            ) {
                return true;
            }

            break;

    }

    throw new ApiError(
        403,
        "You cannot assign work to this user."
    );

};

const canModifyResource = (
    currentUserId,
    resource
) => {

    if (resource.createdById !== currentUserId) {

        throw new ApiError(
            403,
            "Only creator can edit/delete this record."
        );

    }

    return true;

};

module.exports = {

    canAssignUser,

    canModifyResource

};