const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

const auth = (req, res, next) => {
  try {

    const candidates = [];

    if (req.cookies?.accessToken) {
      candidates.push(req.cookies.accessToken);
    }

    if (req.headers.authorization?.startsWith("Bearer ")) {
      candidates.push(req.headers.authorization.split(" ")[1]);
    }

    if (candidates.length === 0) {
      return next(new ApiError(401, "Unauthorized"));
    }

    let lastError = null;

    for (const token of candidates) {
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
      } catch (err) {
        lastError = err;
        // try the next candidate, if any
      }
    }

    // Every candidate failed verification.
    return next(new ApiError(401, "Invalid accessToken"));
  } catch (err) {
    next(new ApiError(401, "Invalid accessToken"));
  }
};

module.exports = auth;