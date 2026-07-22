const { postgresDb } = require("../../config/db");
const { mysqlDb } = require("../../config/db");

const findUserById = async (id) => {
  return await mysqlDb.users.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      access_role: true,
      department_id: true,
      subDepartment_id: true,
      manager_id: true,
      is_active: true,
    },
  });
};

const findUserByEmail = async (email) => {
  return await postgresDb.user.findUnique({ where: { email } });
};

const findUserByUsername = async (username) => {
  return await mysqlDb.users.findFirst({ where: { username } });
};

const createUserInDb = async (userData) => {
  return await postgresDb.user.create({
    data: userData,
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      managerId: true,
      createdAt: true,
    },
  });
};

module.exports = {
  findUserById,
  findUserByEmail,
  findUserByUsername,
  createUserInDb,
};