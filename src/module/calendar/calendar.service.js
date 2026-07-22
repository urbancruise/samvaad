const ApiError = require("../../utils/ApiError");
const { 
  getCalendarData, 
  getTodayAgenda, 
  getWeeklyAgenda,
  getMonthlyCalendar,
  rescheduleEvent,
  checkActivityConflict,
  searchCalendar,
  getCalendarAnalytics
} = require("./calendar.repository");

const { 
  buildCalendarEvents, 
  buildTodayAgenda, 
  buildWeeklyAgenda,
  buildMonthlyCalendar 
} = require("./calendar.helper");

const { validateWorkingHours } = require("./calendar.validation");

const getCalendarEventsService = async (userId, start, end) => {
  try {
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(startDate);

    if (!end) {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(startDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const data = await getCalendarData(userId, startDate, endDate);
    const events = buildCalendarEvents(data);

    return buildMonthlyCalendar(events);
  } catch (error) {
    console.error("Error in getCalendarEventsService:", error);
    throw error;
  }
};

const getTodayAgendaService = async (userId) => {
  try {
    const data = await getTodayAgenda(userId);
    return buildTodayAgenda(data);
  } catch (error) {
    console.error("Error in getTodayAgendaService:", error);
    throw error;
  }
};

const getWeeklyAgendaService = async (userId, date) => {
  try {
    const current = date ? new Date(date) : new Date();
    const weekStart = new Date(current);
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    weekStart.setDate(current.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const data = await getWeeklyAgenda(userId, weekStart, weekEnd);
    return buildWeeklyAgenda(data);
  } catch (error) {
    console.error("Error in getWeeklyAgendaService:", error);
    throw error;
  }
};

const getMonthlyCalendarService = async (userId, year, month, filters) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const data = await getMonthlyCalendar(userId, startDate, endDate, filters);
    return buildMonthlyCalendar(data);
  } catch (error) {
    console.error("Error in getMonthlyCalendarService:", error);
    throw error;
  }
};

const rescheduleEventService = async (userId, payload) => {
  try {
    validateWorkingHours(payload.startDate, payload.dueDate);

    if (payload.type === "ACTIVITY") {
      const conflict = await checkActivityConflict(
        userId,
        payload.id,
        new Date(payload.startDate),
        new Date(payload.dueDate)
      );

      if (conflict) {
        throw new ApiError(409, `Time conflict with "${conflict.title}"`);
      }
    }

    const { id, type, startDate, dueDate } = payload;
    return await rescheduleEvent(id, type, new Date(startDate), new Date(dueDate));
  } catch (error) {
    console.error("Error in rescheduleEventService:", error);
    throw error;
  }
};

const searchCalendarService = async (userId, filters) => {
  try {
    const data = await searchCalendar(userId, filters);
    return buildMonthlyCalendar(data);
  } catch (error) {
    console.error("Error in searchCalendarService:", error);
    throw error;
  }
};

const getCalendarAnalyticsService = async (userId, year, month) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const analytics = await getCalendarAnalytics(userId, startDate, endDate);

    return {
      summary: {
        totalGoals: analytics.goals,
        totalTasks: analytics.tasks,
        totalActivities: analytics.activities,
        completedActivities: analytics.completed,
        pendingActivities: analytics.activities - analytics.completed,
        overdueActivities: analytics.overdue,
        completionRate: analytics.activities
          ? Number(((analytics.completed / analytics.activities) * 100).toFixed(1))
          : 0,
      },
      workload: analytics.workload.map((day) => ({
        date: day.startDate,
        activities: day._count,
      })),
      upcomingDeadlines: analytics.upcomingDeadlines,
    };
  } catch (error) {
    console.error("Error in getCalendarAnalyticsService:", error);
    throw error;
  }
};

module.exports = {
  getCalendarEventsService,
  getTodayAgendaService,
  getWeeklyAgendaService,
  getMonthlyCalendarService,
  rescheduleEventService,
  searchCalendarService,
  getCalendarAnalyticsService,
};