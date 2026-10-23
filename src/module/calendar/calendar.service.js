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
const { mysqlDb } = require("../../config/db");
const { normalizeRole, getSubordinateIds } = require("../../utils/hierarchy.service");

const { 
  buildCalendarEvents, 
  buildTodayAgenda, 
  buildWeeklyAgenda,
  buildMonthlyCalendar 
} = require("./calendar.helper");

const { validateWorkingHours } = require("./calendar.validation");
const resolveRange = (start, end) => {
  const startDate = start ? new Date(start) : new Date();
  const endDate = end ? new Date(end) : new Date(startDate);
  if (!end) {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setMonth(startDate.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  }
  return { startDate, endDate };
};

// The helper strips assignee / description / parent / progress, so re-attach them by id.
const annotateEvents = async (events, data) => {
  const meta = new Map();
  data.goals.forEach((g) => meta.set(g.id, { owner: g.assignedToId, description: g.description, parent: null, progress: g.progress }));
  data.tasks.forEach((t) => meta.set(t.id, { owner: t.assignedToId, description: t.description, parent: t.goal?.title ?? null, progress: t.progress }));
  data.activities.forEach((a) => meta.set(a.id, { owner: a.assignedToId, description: a.description, parent: a.task?.title ?? null, progress: a.progress }));

  const ownerIds = [...new Set([...meta.values()].map((m) => m.owner))];
  const users = ownerIds.length
    ? await mysqlDb.users.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const names = Object.fromEntries(
    users.map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()])
  );

  return events.map((e) => {
    const m = meta.get(e.id) ?? {};
    return {
      ...e,
      progress: m.progress ?? e.progress ?? 0,
      description: m.description ?? null,
      parentTitle: m.parent ?? null,
      assignedToId: m.owner ?? null,
      assigneeName: names[m.owner] ?? null,
    };
  });
};

// userIds: a single id (own / one person) or an array (team)
const getCalendarEventsService = async (userIds, start, end) => {
  try {
    const { startDate, endDate } = resolveRange(start, end);
    const data = await getCalendarData(userIds, startDate, endDate);
    return annotateEvents(buildMonthlyCalendar(data), data);
  } catch (error) {
    console.error("Error in getCalendarEventsService:", error);
    throw error;
  }
};

// Admin = whole org (except self). Everyone else = all juniors below them.
const getTeamScopeIds = async (viewer) => {
  const role = normalizeRole(viewer.role);
  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    const rows = await mysqlDb.users.findMany({
      where: { id: { not: Number(viewer.id) } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  return [...(await getSubordinateIds(viewer.id))];
};

const getTeamCalendarEventsService = async (viewer, start, end) => {
  const ids = await getTeamScopeIds(viewer);
  return getCalendarEventsService(ids, start, end);
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
  getTeamCalendarEventsService
};