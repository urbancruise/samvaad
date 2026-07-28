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

const noCache = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
};

// router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/refresh", refreshToken);

router.post("/logout", logoutUser);

router.get("/me", noCache, auth, getCurrentUser);

router.get("/profile", noCache, auth, getProfile);


module.exports = router;