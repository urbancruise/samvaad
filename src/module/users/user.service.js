const bcrypt = require("bcrypt");
const ApiError = require("../../utils/ApiError");
const userRepo = require("./user.repository");
const {mysqlDb} = require('../../config/db')

const createUser = async (data) => {
  try {
    const existingUsername = await userRepo.findUserByUsername(data.username);
    if (existingUsername) {
      throw new ApiError(409, "Username is already taken");
    }

    const safeRole = ["USER", "EMPLOYEE"].includes(data.role?.toUpperCase()) 
      ? data.role.toUpperCase() 
      : "EMPLOYEE"; 

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return await userRepo.createUserInDb({
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: hashedPassword,
      role: safeRole,
      managerId: data.managerId || null,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Error in createUser service:", error);
    throw error;
  }
};

const findUserByEmail = async (email) => {
  return await userRepo.findUserByEmail(email);
};
const getUserById = async (id) => {
  return await userRepo.findUserById(id);
};

const findUserByUsername = async (username) => {
  return await mysqlDb.users.findFirst({ where: { username } });
};

/**
 * Normalized to the SAME shape /auth/login returns (role, not
 * access_role) — AuthInitializer dispatches whatever this returns
 * straight into Redux, and every user.role check downstream
 * (ProtectedRoute, role-based redirects, permission gating) depends
 * on this exact field name. Without this mapping, role was undefined
 * on every page refresh even though login itself worked fine, since
 * findUserById's raw MySQL column is access_role — this was the
 * actual root cause of the refresh -> /unauthorized bug.
 */
const getProfileService = async (userId) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new ApiError(404, "User not found");

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.access_role,
    department_id: user.department_id,
    subDepartment_id: user.subDepartment_id,
    manager_id: user.manager_id,
    is_active: user.is_active,
  };
};

module.exports = {
  createUser,
  findUserByEmail,
  getUserById,
  getProfileService,
  findUserByUsername
};