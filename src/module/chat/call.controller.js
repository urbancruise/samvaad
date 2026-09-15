const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { getCallHistoryService } = require("./call.service");

// Live call actions (initiate/accept/decline/leave/WebRTC signaling)
// go through sockets — see call.socket.js — since they need to be
// realtime and instantly reach every invited participant. This
// controller only covers the REST call-log/history view.
const getCallHistory = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 30;
  const calls = await getCallHistoryService(req.user.id, { page, limit });

  return res.status(200).json(new ApiResponse(200, calls, "Call history fetched"));
});

module.exports = { getCallHistory };