const { postgresDb } = require("../../config/db");

const { sendNotification } = require("../notifications/notification.service");

const checkAndGenerateRewards = async (
    userId,
    performance
) => {

    const rewards = [];

    // Star Performer
    if (performance.performanceScore >= 90) {

        rewards.push({
            title: "Star Performer",
            description: "Performance score reached 90+",
            rewardType: "BADGE",
            badge: "STAR_PERFORMER",
            points: 100
        });

    }

    // Productivity Bonus
    if (performance.completedActivities >= 100) {

        rewards.push({
            title: "Century Club",
            description: "Completed 100 activities",
            rewardType: "BADGE",
            badge: "CENTURY_CLUB",
            points: 150
        });

    }

    // Perfect Week
    if (
        performance.overdueActivities === 0 &&
        performance.completedActivities >= 20
    ) {

        rewards.push({
            title: "Perfect Week",
            description: "No overdue activities",
            rewardType: "BADGE",
            badge: "PERFECT_WEEK",
            points: 75
        });

    }

    for (const reward of rewards) {

        const exists =
        await postgresDb.reward.findFirst({

            where:{
                userId,
                badge:reward.badge
            }

        });

        if(exists) continue;

        await postgresDb.reward.create({

            data:{

                ...reward,

                userId,

                issuedById:userId,

                status:"ISSUED",

                awardedAt:new Date()

            }

        });

        await sendNotification({

            userId,

            title:"🎉 Reward Unlocked",

            message:`You earned "${reward.title}"`,

            type:"SYSTEM"

        });

    }

};

module.exports={
    checkAndGenerateRewards
};