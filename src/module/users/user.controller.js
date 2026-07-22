const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  generateAccessToken,
  generateRefreshToken
} = require("../../utils/generateToken");

const {
  findUserByEmail,
  findUserByUsername,
  getUserById,
  getProfileService
} = require("./user.service");

const ApiError = require("../../utils/ApiError");
const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");



// user.controller.js — loginUser (updated)
const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body; 
  if (!username || !password) {
    throw new ApiError(400, "Username and password are required");
  }

  const user = await findUserByUsername(username);
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.is_active) {
    throw new ApiError(403, "Your account has been disabled");
  }

  if (!user.password) {
    throw new ApiError(401, "Account has no password set");
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid credentials");
  }
const tokenUser = {
  id: user.id,
  role: user.access_role,
};

const accessToken = generateAccessToken(tokenUser);
const refreshToken = generateRefreshToken(tokenUser);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.status(200).json(
    new ApiResponse(200, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.access_role,        // <-- this is your real role field
        department_id: user.department_id,
        subDepartment_id: user.subDepartment_id,
        manager_id: user.manager_id,
      },
    }, "Login Successful")
  );
});


const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  
  if (!user.isActive) {
    throw new ApiError(403, "Account disabled");
  }

  return res.status(200).json(
    new ApiResponse(200, user, "Current user fetched successfully")
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res.status(200).json(
    new ApiResponse(200, null, "Logout Successful")
  );
});

const refreshToken = asyncHandler(async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      throw new ApiError(401, "Unauthorized");
    }
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await getUserById(decoded.id);
    if (!user || !user.isActive) {
      throw new ApiError(401, "Unauthorized");
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          accessToken,
          refreshToken: newRefreshToken
        },
        "Token Refreshed"
      )
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Refresh Token Expired");
  }
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await getProfileService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, user, "Profile fetched successfully")
  );
});

module.exports = {
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshToken,
  getProfile
};