const buildDeadlines = (activities) => {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const deadlines = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
  };

  activities.forEach(activity => {
    
      if (!activity.dueDate) return;

    const due = new Date(activity.dueDate);
    due.setHours(0, 0, 0, 0);

    if (due < today) {
      deadlines.overdue.push(activity);
    } else if (due.getTime() === today.getTime()) {
      deadlines.today.push(activity);
    } else if (due.getTime() === tomorrow.getTime()) {
      deadlines.tomorrow.push(activity);
    } else if (due <= weekEnd) {
      deadlines.thisWeek.push(activity);
    }

  });

  return deadlines;

};

module.exports = {
  buildDeadlines,
};