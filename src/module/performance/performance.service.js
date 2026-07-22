const {
  getPerformanceMetrics,
  getAchievements,
  getPerformanceAnalytics
} = require("./performance.repository");

const { checkAndGenerateRewards } = require("./performance.reward");
const { saveMonthlySnapshot } = require("./performance.snapshot");

const percentage = (completed, total) => {
  if (!total) return 0;
  return completed / total;
};

const getPerformanceDashboardService = async (userId) => {
  try {
    const data = await getPerformanceMetrics(userId);

    const goalScore = percentage(data.completedGoals, data.goals) * 20;
    const taskScore = percentage(data.completedTasks, data.tasks) * 25;
    const activityScore = percentage(data.completedActivities, data.activities) * 35;
    const onTimeScore = percentage(data.onTimeActivities, data.completedActivities) * 15;

    const productivityScore = data.overdueActivities === 0
      ? 5
      : Math.max(0, 5 - data.overdueActivities);

    const performanceScore = goalScore + taskScore + activityScore + onTimeScore + productivityScore;

    return {
      scores: {
        goalScore: Number(goalScore.toFixed(2)),
        taskScore: Number(taskScore.toFixed(2)),
        activityScore: Number(activityScore.toFixed(2)),
        onTimeScore: Number(onTimeScore.toFixed(2)),
        productivityScore: Number(productivityScore.toFixed(2)),
        performanceScore: Number(performanceScore.toFixed(2))
      },
      metrics: data
    };
  } catch (error) {
    console.error(`Error in getPerformanceDashboardService for user ${userId}:`, error);
    throw error;
  }
};

const getAchievementsService = async (userId) => {
  try {
    return await getAchievements(userId);
  } catch (error) {
    console.error(`Error in getAchievementsService for user ${userId}:`, error);
    throw error;
  }
};

const getPerformanceAnalyticsService = async (userId, period) => {
  try {
    const analytics = await getPerformanceAnalytics(userId, period);

    if (!analytics || !analytics.length) {
      return {
        trend: [],
        summary: {}
      };
    }

    const averagePerformance = analytics.reduce((sum, item) => sum + item.performanceScore, 0) / analytics.length;

    return {
      trend: analytics.map(item => ({
        period: item.startDate.toISOString().substring(0, 7),
        performanceScore: item.performanceScore,
        completionRate: item.completionRate,
        productivityScore: item.productivityScore
      })),
      summary: {
        averagePerformance: Number(averagePerformance.toFixed(2)),
        highestPerformance: Math.max(...analytics.map(x => x.performanceScore)),
        lowestPerformance: Math.min(...analytics.map(x => x.performanceScore))
      }
    };
  } catch (error) {
    console.error(`Error in getPerformanceAnalyticsService for user ${userId} and period ${period}:`, error);
    throw error;
  }
};

module.exports = {
  getPerformanceDashboardService,
  getAchievementsService,
  getPerformanceAnalyticsService
};