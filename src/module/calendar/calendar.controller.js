const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const { isSelfOrSubordinate } = require("../../utils/hierarchy.service");

const {
  getCalendarEventsService,
  getTodayAgendaService,
  getWeeklyAgendaService,
  getMonthlyCalendarService,
  rescheduleEventService,
  searchCalendarService,
  getCalendarAnalyticsService
} = require("./calendar.service");

const getCalendarEvents = asyncHandler(async (req, res) => {
  const { start, end } = req.query;

  const events = await getCalendarEventsService(
    req.user.id,
    start,
    end
  );

  return res.status(200).json(
    new ApiResponse(200, events, "Calendar events fetched successfully")
  );
});

const getTodayAgenda = asyncHandler(async (req, res) => {
  const agenda = await getTodayAgendaService(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, agenda, "Today's agenda fetched successfully")
  );
});

const getWeeklyAgenda = asyncHandler(async (req, res) => {
  const { date } = req.query;

  const agenda = await getWeeklyAgendaService(
    req.user.id,
    date
  );

  return res.status(200).json(
    new ApiResponse(200, agenda, "Weekly agenda fetched successfully")
  );
});

const getMonthlyCalendar = asyncHandler(async (req, res) => {
  const { year, month, type, priority, status } = req.query;

  const events = await getMonthlyCalendarService(
    req.user.id,
    Number(year),
    Number(month),
    { type, priority, status }
  );

  return res.status(200).json(
    new ApiResponse(200, events, "Monthly calendar fetched successfully")
  );
});

const rescheduleEvent = asyncHandler(async (req, res) => {
  const event = await rescheduleEventService(req.user.id, req.body);

  return res.status(200).json(
    new ApiResponse(200, event, "Event rescheduled successfully")
  );
});

const getCalendarSearch = asyncHandler(async (req, res) => {
  const events = await searchCalendarService(
    req.user.id,
    req.query
  );

  return res.status(200).json(
    new ApiResponse(200, events, "Calendar search successful")
  );
});

const getCalendarAnalytics = asyncHandler(async (req, res) => {
  const analytics = await getCalendarAnalyticsService(
    req.user.id,
    req.query.year,
    req.query.month
  );

  return res.status(200).json(
    new ApiResponse(200, analytics, "Calendar analytics fetched successfully")
  );
});

/**
 * Generic "view someone else's calendar" — used by every profile/team
 * module (TL viewing an Employee, Manager viewing a TL, HOD viewing a
 * Manager, Admin viewing anyone). Same isSelfOrSubordinate gate as
 * performance.controller.js's equivalent endpoints. Read-only — no
 * reschedule-for-other-user endpoint, since juniors manage their own
 * schedule.
 */
const ensureCanViewUser = async (req) => {
  const allowed = await isSelfOrSubordinate(req.user.id, req.params.userId, req.user.role);
  if (!allowed) {
    throw new ApiError(403, "You are not allowed to view this user's calendar.");
  }
};

const getUserCalendarEvents = asyncHandler(async (req, res) => {
  await ensureCanViewUser(req);
  const { start, end } = req.query;

  const events = await getCalendarEventsService(Number(req.params.userId), start, end);

  return res.status(200).json(
    new ApiResponse(200, events, "Calendar events fetched successfully")
  );
});

const getUserTodayAgenda = asyncHandler(async (req, res) => {
  await ensureCanViewUser(req);

  const agenda = await getTodayAgendaService(Number(req.params.userId));

  return res.status(200).json(
    new ApiResponse(200, agenda, "Today's agenda fetched successfully")
  );
});

const getUserWeeklyAgenda = asyncHandler(async (req, res) => {
  await ensureCanViewUser(req);
  const { date } = req.query;

  const agenda = await getWeeklyAgendaService(Number(req.params.userId), date);

  return res.status(200).json(
    new ApiResponse(200, agenda, "Weekly agenda fetched successfully")
  );
});

module.exports = {
  getCalendarEvents,
  getTodayAgenda,
  getWeeklyAgenda,
  getMonthlyCalendar,
  rescheduleEvent,
  getCalendarSearch,
  getCalendarAnalytics,
  getUserCalendarEvents,
  getUserTodayAgenda,
  getUserWeeklyAgenda,
};