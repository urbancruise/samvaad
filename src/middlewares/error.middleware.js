const errorHandler = (err, req, res, next) => {
  // 1. Check for a custom statusCode on the error object first to bypass the precedence bug
  let statusCode = err.statusCode;

  if (!statusCode) {
    // 2. Fallback to response code or default to 500
    statusCode = res.statusCode === 200 ? 500 : res.statusCode || 500;
  }

  const message = err.message || "Internal Server Error";

  console.error(`[Application Error] ${req.method} ${req.url} - Status: ${statusCode}`, err);

  return res.status(statusCode).json({
    statusCode,
    success: false,
    message,
    errors: err.errors || []
  });
};

module.exports = errorHandler;