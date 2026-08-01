const ApiError = require("../../utils/ApiError");
const { normalizeRole, isTopLevel } = require("../../utils/hierarchy.service");
const { getFieldConfig } = require("./Rating.fieldConfig");

const {
  formatName,
  getAllDepartments,
  getDepartmentById,
  getDepartmentsByIds,
  getDirectReports,
  getAllUsersForRating,
  findUserWithManager,
  getRatingRows,
  getRatingRowsForTeam,
  upsertRatingRow,
} = require("./rating.repository");

/**
 * 5-band classification, applied to the OFFICIAL/final score — the
 * Senior's rating if one exists, falling back to Self if the senior
 * hasn't rated yet. Self alone is never treated as final since it's
 * a self-assessment, not the official review.
 */
const RATING_BANDS = [
  { key: "SUPER_ACHIEVER", label: "Super Achiever", min: 14, color: "emerald" },
  { key: "EXCELLENT_PERFORMER", label: "Excellent Performer", min: 12, color: "blue" },
  { key: "GOOD_JOB", label: "Good Job", min: 9, color: "amber" },
  { key: "NEED_IMPROVEMENT", label: "Need Improvement", min: 6, color: "orange" },
  { key: "DO_OR_DIE", label: "Do or Die", min: 0, color: "rose" },
];

const getBand = (total) => {
  return RATING_BANDS.find((b) => total >= b.min) ?? RATING_BANDS[RATING_BANDS.length - 1];
};

const getOverall = (selfRow, seniorRow) => {
  const total = seniorRow ? computeTotal(seniorRow) : selfRow ? computeTotal(selfRow) : 0;
  const isFinal = Boolean(seniorRow); // official once the senior has rated
  return { total, band: getBand(total), isFinal };
};

const computeTotal = (row) => {
  if (!row) return 0;
  return (row.salesScore ?? 0) + (row.conductScore ?? 0) + (row.contributionScore ?? 0);
};

const shapeRow = (row) => {
  if (!row) return null;
  return {
    salesScore: row.salesScore,
    conductScore: row.conductScore,
    contributionScore: row.contributionScore,
    achievementPercent: row.achievementPercent,
    extraFields: row.extraFields ?? {},
    total: computeTotal(row),
    updatedAt: row.updatedAt,
    raterId: row.raterId,
  };
};

const getDepartmentsService = async () => {
  return getAllDepartments();
};

const getFieldConfigService = async (departmentId) => {
  const dept = await getDepartmentById(departmentId);
  return {
    department: dept,
    fields: getFieldConfig(dept?.name),
  };
};

/**
 * One employee's Self + Senior rows for a period, plus the field
 * config for their department. Viewing is allowed for the employee
 * themself, anyone in their management chain, or SUPER_ADMIN —
 * reusing the same isSelfOrSubordinate check used everywhere else,
 * but implemented locally here since we need the employee record
 * regardless (to resolve their department for field config).
 */
const getEmployeeRatingService = async (viewerId, viewerRole, employeeId, period) => {
  const employee = await findUserWithManager(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found.");

  const role = normalizeRole(viewerRole);
  const isSelf = Number(viewerId) === Number(employeeId);
  const isDirectManager = Number(employee.manager_id) === Number(viewerId);

  if (!isSelf && !isDirectManager && !isTopLevel(role)) {
    // Not self, not their direct senior, not admin — still allow if
    // viewer is further up the same chain (e.g. Manager viewing an
    // Employee two levels down). Walk up via manager_id.
    let current = employee;
    let allowed = false;
    for (let i = 0; i < 10 && current?.manager_id; i++) {
      if (Number(current.manager_id) === Number(viewerId)) {
        allowed = true;
        break;
      }
      current = await findUserWithManager(current.manager_id);
    }
    if (!allowed) {
      throw new ApiError(403, "You are not allowed to view this person's rating.");
    }
  }

  const rows = await getRatingRows(employee.id, period);
  const selfRow = rows.find((r) => r.raterType === "SELF");
  const seniorRow = rows.find((r) => r.raterType === "SENIOR");

  const dept = await getDepartmentById(employee.department_id);

  return {
    employee: {
      id: employee.id,
      fullName: formatName(employee),
      role: employee.access_role,
      departmentId: employee.department_id,
      departmentName: dept?.name ?? null,
    },
    period,
    fields: getFieldConfig(dept?.name),
    self: shapeRow(selfRow),
    senior: shapeRow(seniorRow),
    overall: getOverall(selfRow, seniorRow),
    canEditSelf: isSelf,
    canEditSenior: isDirectManager || isTopLevel(role),
  };
};

/**
 * Team grid — direct reports only (matches "Self + one direct senior"
 * rule), or org-wide for SUPER_ADMIN. Optional department filter.
 * Also returns a band-summary count for the 5-band dashboard cards.
 */
const getTeamRatingService = async (viewerId, viewerRole, { department, period }) => {
  const role = normalizeRole(viewerRole);

  const reports = isTopLevel(role)
    ? await getAllUsersForRating(department)
    : await getDirectReports(viewerId, department);

  // Every viewer sees their own record too — not just their direct
  // reports. Without this, anyone with no one reporting to them
  // (every Employee, or a TL/Manager whose team is currently empty)
  // would see a blank grid with no way to self-rate at all.
  const self = await findUserWithManager(viewerId);
  const employees = self
    ? [self, ...reports.filter((r) => Number(r.id) !== Number(viewerId))]
    : reports;

  if (employees.length === 0) {
    return {
      employees: [],
      teamAverage: 0,
      period,
      bandSummary: RATING_BANDS.map((b) => ({ ...b, count: 0 })),
    };
  }

  const employeeIds = employees.map((e) => e.id);
  const rows = await getRatingRowsForTeam(employeeIds, period);

  // One query for every department involved, instead of one query PER
  // employee inside the loop below (an N+1 that got slower the bigger
  // the team was — a real contributor to the slow load times).
  const deptMap = await getDepartmentsByIds(employees.map((e) => e.department_id));

  const allTotals = [];
  const bandCounts = Object.fromEntries(RATING_BANDS.map((b) => [b.key, 0]));

  const shaped = employees.map((emp) => {
    const empRows = rows.filter((r) => r.employeeId === emp.id);
    const selfRow = empRows.find((r) => r.raterType === "SELF");
    const seniorRow = empRows.find((r) => r.raterType === "SENIOR");

    if (selfRow) allTotals.push(computeTotal(selfRow));
    if (seniorRow) allTotals.push(computeTotal(seniorRow));

    const overall = getOverall(selfRow, seniorRow);
    // Only count someone toward a band once their official (senior)
    // rating exists — an all-null row would otherwise pile up in
    // "Do or Die" just for not having been rated yet.
    if (overall.isFinal) {
      bandCounts[overall.band.key] += 1;
    }

    const dept = deptMap.get(Number(emp.department_id)) ?? null;

    return {
      id: emp.id,
      fullName: formatName(emp),
      role: emp.access_role,
      departmentId: emp.department_id,
      departmentName: dept?.name ?? null,
      fields: getFieldConfig(dept?.name),
      self: shapeRow(selfRow),
      senior: shapeRow(seniorRow),
      overall,
      // The list mixes the viewer's own record with their actual
      // direct reports (or, for SUPER_ADMIN, everyone) — only the
      // latter should ever be senior-editable. Without this, the
      // frontend can't tell "my own row" apart from "someone I
      // manage" and would let people submit their own senior score.
      canEditSenior: Number(emp.id) !== Number(viewerId),
    };
  });

  const teamAverage = allTotals.length
    ? Number((allTotals.reduce((a, b) => a + b, 0) / allTotals.length).toFixed(1))
    : 0;

  const bandSummary = RATING_BANDS.map((b) => ({ ...b, count: bandCounts[b.key] }));

  return { employees: shaped, teamAverage, period, bandSummary };
};

const upsertSelfRatingService = async (userId, employeeId, period, data) => {
  if (Number(userId) !== Number(employeeId)) {
    throw new ApiError(403, "You can only submit your own self-rating.");
  }

  const employee = await findUserWithManager(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found.");

  const row = await upsertRatingRow({
    employeeId,
    raterId: userId,
    raterType: "SELF",
    period,
    departmentId: employee.department_id,
    salesScore: data.salesScore ?? null,
    conductScore: data.conductScore ?? null,
    contributionScore: data.contributionScore ?? null,
    achievementPercent: data.achievementPercent ?? null,
    extraFields: data.extraFields ?? {},
  });

  return shapeRow(row);
};

const upsertSeniorRatingService = async (userId, userRole, employeeId, period, data) => {
  const employee = await findUserWithManager(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found.");

  const role = normalizeRole(userRole);
  const isDirectManager = Number(employee.manager_id) === Number(userId);

  if (!isDirectManager && !isTopLevel(role)) {
    throw new ApiError(403, "Only this person's direct senior (or an admin) can submit this rating.");
  }

  const row = await upsertRatingRow({
    employeeId,
    raterId: userId,
    raterType: "SENIOR",
    period,
    departmentId: employee.department_id,
    salesScore: data.salesScore ?? null,
    conductScore: data.conductScore ?? null,
    contributionScore: data.contributionScore ?? null,
    achievementPercent: data.achievementPercent ?? null,
    extraFields: data.extraFields ?? {},
  });

  return shapeRow(row);
};

module.exports = {
  getDepartmentsService,
  getFieldConfigService,
  getEmployeeRatingService,
  getTeamRatingService,
  upsertSelfRatingService,
  upsertSeniorRatingService,
  RATING_BANDS,
  getBand,
};