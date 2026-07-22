const buildCalendarEvents = ({
  goals,
  tasks,
  activities,
}) => {

  return [

    ...goals.map(goal => ({
      id: goal.id,
      type: "GOAL",
      title: goal.title,
      start: goal.startDate,
      end: goal.dueDate,
      status: goal.status,
      priority: goal.priority,
      goalId: goal.id,
    })),

    ...tasks.map(task => ({
      id: task.id,
      type: "TASK",
      title: task.title,
      start: task.startDate,
      end: task.dueDate,
      status: task.status,
      priority: task.priority,
      taskId: task.id,
      goalId: goal.id,
    })),

    ...activities.map(activity => ({
      id: activity.id,
      type: "ACTIVITY",
      title: activity.title,
      start: activity.startDate,
      end: activity.dueDate,
      status: activity.status,
      priority: activity.priority,
      progress: activity.progress,
      activityId: activity.id,
      taskId: activity.taskId,
      goalId: activity.task.goalId,
    })),
  ];

};

const buildTodayAgenda = ({
  goals,
  tasks,
  activities,
  goalId,
  taskId,
  activityId
}) => {

  const agenda = [

    ...goals.map(goal => ({
      id: goal.id,
      type: "GOAL",
      title: goal.title,
      start: goal.startDate,
      end: goal.dueDate,
      priority: goal.priority,
      status: goal.status,
    })),

    ...tasks.map(task => ({
      id: task.id,
      type: "TASK",
      title: task.title,
      start: task.startDate,
      end: task.dueDate,
      priority: task.priority,
      status: task.status,
    })),

    ...activities.map(activity => ({
      id: activity.id,
      type: "ACTIVITY",
      title: activity.title,
      start: activity.startDate,
      end: activity.dueDate,
      priority: activity.priority,
      status: activity.status,
      progress: activity.progress,
    })),

  ];

  agenda.sort((a, b) => {

    if (!a.start) return 1;
    if (!b.start) return -1;

    return new Date(a.start) - new Date(b.start);

  });

  return agenda;

};


const buildWeeklyAgenda = ({
  goals,
  tasks,
  activities,
}) => {

  const week = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  const addItem = (item, type) => {

    if (!item.startDate) return;

    const day = new Date(item.startDate)
      .toLocaleDateString("en-US", {
        weekday: "long",
      });

    week[day].push({
      id: item.id,
      type,
      title: item.title,
      start: item.startDate,
      end: item.dueDate,
      priority: item.priority,
      status: item.status,
    });

  };

  goals.forEach(goal => addItem(goal, "GOAL"));
  tasks.forEach(task => addItem(task, "TASK"));
  activities.forEach(activity => addItem(activity, "ACTIVITY"));

  return week;

};

const {
    EVENT_COLORS,
} = require("./calendar.constants");

const getEventColor = (
    type,
    priority,
    status,
    dueDate
) => {

    if (status === "COMPLETED") {

        return EVENT_COLORS.COMPLETED;

    }

    if (
        status !== "COMPLETED" &&
        new Date(dueDate) < new Date()
    ) {

        return EVENT_COLORS.OVERDUE;

    }

    const today = new Date();

    if (
        new Date(dueDate).toDateString() ===
        today.toDateString()
    ) {

        return EVENT_COLORS.TODAY;

    }

    switch (type) {

        case "GOAL":
            return EVENT_COLORS.GOAL;

        case "TASK":
            return EVENT_COLORS.TASK;

        default:
            return EVENT_COLORS.ACTIVITY;

    }

};

const buildMonthlyCalendar = ({
    goals,
    tasks,
    activities,
}) => {

    return [

        ...goals.map(goal => ({

            id: goal.id,

            title: goal.title,

            start: goal.startDate,

            end: goal.dueDate,

            allDay: true,

            backgroundColor: getEventColor(
                "GOAL",
                goal.priority,
                goal.status,
                goal.dueDate
            ),

            borderColor: getEventColor(
                "GOAL",
                goal.priority,
                goal.status,
                goal.dueDate
            ),

            extendedProps: {

                type: "GOAL",

                status: goal.status,

                priority: goal.priority,

                goalId: goal.id,

                taskId: null,

                activityId: null,

            }

        })),



        ...tasks.map(task => ({

            id: task.id,

            title: task.title,

            start: task.startDate,

            end: task.dueDate,

            backgroundColor: getEventColor(
                "TASK",
                task.priority,
                task.status,
                task.dueDate
            ),

            borderColor: getEventColor(
                "TASK",
                task.priority,
                task.status,
                task.dueDate
            ),

            extendedProps: {

                type: "TASK",

                status: task.status,

                priority: task.priority,

                goalId: task.goalId,

                taskId: task.id,

                activityId: null,

            }

        })),



        ...activities.map(activity => ({

            id: activity.id,

            title: activity.title,

            start: activity.startDate,

            end: activity.dueDate,

            backgroundColor: getEventColor(
                "ACTIVITY",
                activity.priority,
                activity.status,
                activity.dueDate
            ),

            borderColor: getEventColor(
                "ACTIVITY",
                activity.priority,
                activity.status,
                activity.dueDate
            ),

            extendedProps: {

                type: "ACTIVITY",

                status: activity.status,

                priority: activity.priority,

                progress: activity.progress,

                goalId: activity.task.goalId,

                taskId: activity.taskId,

                activityId: activity.id,

            }

        }))

    ];

};

module.exports = {
  getEventColor,
  buildCalendarEvents,
  buildTodayAgenda,
  buildWeeklyAgenda,
  buildMonthlyCalendar,
};
