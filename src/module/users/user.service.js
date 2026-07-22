const bcrypt = require("bcrypt");
const ApiError = require("../../utils/ApiError");
const userRepo = require("./user.repository");
const { get } = require("./user.route");
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

const getProfileService = async (userId) => {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

module.exports = {
  createUser,
  findUserByEmail,
  getUserById,
  getProfileService,
  findUserByUsername
};