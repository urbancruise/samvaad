const minutesBetween = (start, end) => {

  if (!start || !end) return 0;

  return Math.floor(
    (end.getTime() - start.getTime()) /
    (1000 * 60)
  );

};
const calculateActualMinutes = (
  startedAt,
  completedAt,
  totalPauseMinutes
) => {

  if (!startedAt || !completedAt)
    return 0;

  const totalMinutes =
    Math.floor(
      (completedAt - startedAt) /
      (1000 * 60)
    );

  return Math.max(
    totalMinutes - totalPauseMinutes,
    0
  );

};


module.exports = {
  minutesBetween,
  calculateActualMinutes
};