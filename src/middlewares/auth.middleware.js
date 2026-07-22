const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

const auth = (req, res, next) => {
  try {
    let accessToken = null;

    // Cookie
    if (req.cookies?.accessToken) {
    accessToken = req.cookies.accessToken;
}

    // Authorization Header
    if (!accessToken && req.headers.authorization) {
      const bearer = req.headers.authorization;

      if (bearer.startsWith("Bearer ")) {
        accessToken = bearer.split(" ")[1];
      }
    }

    if (!accessToken) {
      return next(new ApiError(401, "Unauthorized"));
      res.redirect('/')
    }

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    next(new ApiError(401, "Invalid accessToken"));
  }
};

module.exports = auth;