const validateWorkingHours = (startDate, dueDate) => {

  const start = new Date(startDate);
  const end = new Date(dueDate);

  const officeStart = new Date(start);
  officeStart.setHours(9, 0, 0, 0);

  const lunchStart = new Date(start);
  lunchStart.setHours(13, 0, 0, 0);

  const lunchEnd = new Date(start);
  lunchEnd.setHours(14, 0, 0, 0);

  const officeEnd = new Date(start);
  officeEnd.setHours(18, 0, 0, 0);

  if (start < officeStart)
    throw new Error("Cannot schedule before office hours.");

  if (end > officeEnd)
    throw new Error("Cannot schedule after office hours.");

  if (
    start < lunchEnd &&
    end > lunchStart
  )
    throw new Error("Activity overlaps lunch break.");

  return true;
};

module.exports = {
  validateWorkingHours,
};