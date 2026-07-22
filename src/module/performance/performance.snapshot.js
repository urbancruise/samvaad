const {
    getPerformanceMetrics,
    upsertPerformance
} = require("./performance.repository");
const {
    checkAchievements
}=require("./achievement.engine");

const saveMonthlySnapshot = async(userId)=>{
    await checkAchievements(userId);
    const now = new Date();

    const startDate =
    new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );

    const endDate =
    new Date(
        now.getFullYear(),
        now.getMonth()+1,
        0,
        23,
        59,
        59
    );

    const metrics =
    await getPerformanceMetrics(userId);

const completionRate =
metrics.activities
?
(
metrics.completedActivities /
metrics.activities
)*100
:0;

    const productivityScore =
    completionRate;

    const performanceScore =
    completionRate;

    return upsertPerformance(

        userId,

        "MONTHLY",

        startDate,

        endDate,

        {

            totalGoals:
            metrics.goals,

            completedGoals:
            metrics.completedGoals,

            totalTasks:
            metrics.tasks,

            completedTasks:
            metrics.completedTasks,

            totalActivities:
            metrics.activities,

            completedActivities:
            metrics.completedActivities,

            completionRate,

            productivityScore,

            qualityScore:0,

            performanceScore

        }

    );

};

module.exports={
    saveMonthlySnapshot
};