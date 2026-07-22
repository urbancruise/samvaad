const { postgresDb } = require("../../config/db");

const createHistory = (data) => {
  return postgresDb.activityHistory.create({
    data,
  });
};

module.exports = {
  createHistory,
};