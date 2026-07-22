const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");

const {
  getCalendarEvents,
  getTodayAgenda,
  getWeeklyAgenda,
  getMonthlyCalendar,
  rescheduleEvent,
  getCalendarSearch,
  getCalendarAnalytics
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

module.exports = router;