const { postgresDb } = require("../../config/db");

const getTeamMembers = async (managerId) => {
  try {
    return await postgresDb.user.findMany({
      where: {
        managerId
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      },
      orderBy: {
        fullName: "asc"
      }
    });
  } catch (error) {
    console.error(`Error in getTeamMembers repository for manager ${managerId}:`, error);
    throw error;
  }
};

const getTeamMemberById = async (managerId, employeeId) => {
  try {
    return await postgresDb.user.findFirst({
      where: {
        id: employeeId,
        managerId
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      }
    });
  } catch (error) {
    console.error(`Error in getTeamMemberById repository for manager ${managerId} and employee ${employeeId}:`, error);
    throw error;
  }
};

const getTeamPerformance = async (employeeIds) => {
  try {
    return await postgresDb.performance.findMany({
      where: {
        userId: {
          in: employeeIds
        },
        period: "MONTHLY"
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Error in getTeamPerformance repository for given employee IDs:", employeeIds, error);
    throw error;
  }
};

const getTeamWorkload = async (managerId) => {
  try {
    return await postgresDb.user.findMany({
      where: {
        managerId
      },
      select: {
        id: true,
        fullName: true,
        assignedGoals: {
          where: {
            status: { not: "COMPLETED" }
          },
          select: {
            id: true
          }
        },
        assignedTasks: {
          where: {
            status: { not: "COMPLETED" }
          },
          select: {
            id: true
          }
        },
        assignedActivities: {
          where: {
            status: { not: "COMPLETED" }
          },
          select: {
            id: true,
            dueDate: true,
            priority: true
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error in getTeamWorkload repository for manager ${managerId}:`, error);
    throw error;
  }
};

const getAssignableEmployees = async (managerId) => {
  try {
    return await postgresDb.user.findMany({
      where: {
        managerId,
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        assignedGoals: {
          where: {
            status: { not: "COMPLETED" }
          },
          select: {
            id: true
          }
        },
        assignedTasks: {
          where: {
            status: { not: "COMPLETED" }
          },
          select: {
            id: true
          }
        },
        assignedActivities: {
          where: {
            status: { not: "COMPLETED" }
          },
          select: {
            id: true
          }
        }
      },
      orderBy: {
        fullName: "asc"
      }
    });
  } catch (error) {
    console.error(`Error in getAssignableEmployees repository for manager ${managerId}:`, error);
    throw error;
  }
};

const getMyTeam = async (teamLeadId) => {
  try {
    return await postgresDb.user.findMany({
      where: {
        managerId: teamLeadId
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        isActive: true,
        role: true,
        assignedGoals: {
          where: {
            status: "COMPLETED"
          },
          select: {
            id: true
          }
        },
        assignedTasks: {
          where: {
            status: "COMPLETED"
          },
          select: {
            id: true
          }
        },
        assignedActivities: {
          where: {
            status: "COMPLETED"
          },
          select: {
            id: true
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error in getMyTeam repository for team lead ${teamLeadId}:`, error);
    throw error;
  }
};

module.exports = {
  getTeamMembers,
  getTeamMemberById,
  getTeamPerformance,
  getTeamWorkload,
  getAssignableEmployees,
  getMyTeam
};