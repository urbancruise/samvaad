const {
    getPerformanceMetrics,
    createAchievement,
    findAchievement
} = require("./performance.repository");

const { sendNotification } = require("../notifications/notification.service");

const unlockAchievement = async (
    userId,
    achievement
)=>{

    const exists =
    await findAchievement(
        userId,
        achievement.badge
    );

    if(exists) return;

    await createAchievement({

        userId,

        title:achievement.title,

        description:achievement.description,

        badge:achievement.badge,

        level:achievement.level,

        points:achievement.points

    });

    await sendNotification({

        userId,

        title:"🏆 Achievement Unlocked",

        message:achievement.title,

        type:"SYSTEM"

    });

};

const checkAchievements =
async(userId)=>{

    const data =
    await getPerformanceMetrics(userId);

    if(data.completedGoals>=1){

        await unlockAchievement(userId,{

            title:"First Goal",

            description:"Completed first goal",

            badge:"FIRST_GOAL",

            level:"BRONZE",

            points:25

        });

    }

    if(data.completedTasks>=10){

        await unlockAchievement(userId,{

            title:"Task Master",

            description:"Completed 10 tasks",

            badge:"TASK_MASTER",

            level:"SILVER",

            points:50

        });

    }

    if(data.completedActivities>=50){

        await unlockAchievement(userId,{

            title:"Activity Champion",

            description:"Completed 50 activities",

            badge:"ACTIVITY_CHAMPION",

            level:"GOLD",

            points:100

        });

    }

};

module.exports={
    checkAchievements
};