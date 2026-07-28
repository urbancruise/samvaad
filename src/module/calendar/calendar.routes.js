const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
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
} = require("./calendar.controller");

router.use(auth);

router.get(
  "/events",
  getCalendarEvents
);

router.get(
  "/today",
  getTodayAgenda
);

router.get(
  "/week",
  getWeeklyAgenda
);

router.get(
  "/month",
  getMonthlyCalendar
);

router.patch(
    "/reschedule",
    rescheduleEvent
);

router.get(
    "/search",
    getCalendarSearch
);

router.get(
    "/analytics",
    getCalendarAnalytics
);

// Generic "view someone else's calendar" — no collision with the literal
// routes above since these require a userId path segment first.
router.get(
    "/:userId/events",
    getUserCalendarEvents
);

router.get(
    "/:userId/today",
    getUserTodayAgenda
);

router.get(
    "/:userId/week",
    getUserWeeklyAgenda
);

module.exports = router;