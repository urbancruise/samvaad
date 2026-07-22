const {
  getOverviewCounts,
  getTodaySummary,
  getProgressAnalytics,
  getPerformanceData,
  getTimelineData,
  getRecentActivities,
  getUpcomingDeadlines,
} = require("./dashboard.repository");

const { calculatePerformance } = require("./helpers/dashboard.performance");
const { buildTimeline } = require("./helpers/dashboard.timeline");
const { buildRecentActivities } = require("./helpers/dashboard.feed");
const { buildDeadlines } = require("./helpers/dashboard.deadlines");

const getEmployeeDashboardService = async (userId) => {
  try {
    const [
      overview,
      today,
      analytics,
      performanceData,
      timelineData,
      recentData,
      deadlineData,
    ] = await Promise.all([
      getOverviewCounts(userId),
      getTodaySummary(userId),
      getProgressAnalytics(userId),
      getPerformanceData(userId),
      getTimelineData(userId),
      getRecentActivities(userId),
      getUpcomingDeadlines(userId),
    ]);

    return {
      overview,
      today,
      analytics,
      performance: calculatePerformance(performanceData),
      timeline: buildTimeline(timelineData),
      recentActivities: buildRecentActivities(recentData),
      deadlines: buildDeadlines(deadlineData),
    };
  } catch (error) {
    console.error(`Failed to compile employee dashboard data for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  getEmployeeDashboardService,
};