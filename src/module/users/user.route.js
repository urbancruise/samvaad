const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshToken,
  getProfile
} = require("./user.controller");

// router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/refresh", refreshToken);

router.post("/logout", logoutUser);

router.get("/me", auth, getCurrentUser);

router.get("/profile", auth, getProfile);


module.exports = router;