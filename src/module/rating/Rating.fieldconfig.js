
const DEPARTMENT_FIELD_CONFIG = {
  SALES: {
    sales: [
      { key: "salesImprovementIdeas", label: "Sales Improvement Ideas" },
    ],
    conduct: [],
    contribution: [
      { key: "initiativesTaken", label: "Initiatives Taken" },
      { key: "processImprovement", label: "Process Improvement" },
    ],
  },

  IT: {
    sales: [
      { key: "technicalImprovementIdeas", label: "Technical Improvement Ideas" },
    ],
    conduct: [],
    contribution: [
      { key: "initiativesTaken", label: "Initiatives Taken" },
      { key: "processImprovement", label: "Process Improvement" },
    ],
  },

  HR: {
    sales: [
      { key: "processImprovementIdeas", label: "Process Improvement Ideas" },
    ],
    conduct: [],
    contribution: [
      { key: "initiativesTaken", label: "Initiatives Taken" },
    ],
  },

  // Fallback for any department not explicitly configured above.
  default: {
    sales: [
      { key: "improvementIdeas", label: "Improvement Ideas" },
    ],
    conduct: [],
    contribution: [
      { key: "initiativesTaken", label: "Initiatives Taken" },
    ],
  },
};

// Fields common to every department's Conduct section, since
// Punctuality/Adherence/Team Coordination read as universal in the
// screenshot rather than department-specific.
const COMMON_CONDUCT_FIELDS = [
  { key: "punctualityNotes", label: "Punctuality & Leaves" },
  { key: "policyAdherenceNotes", label: "Adherence to Office Policies" },
  { key: "teamCoordinationNotes", label: "Team Coordination" },
];

// Fields common to every department's Sales/Targets section.
const COMMON_SALES_FIELDS = [
  { key: "targetsVsActual", label: "Targets VS Actual" },
  { key: "achievementPercent", label: "Achievement %", isNumeric: true },
];

const getFieldConfig = (departmentName) => {
  const key = (departmentName || "").toUpperCase();
  const deptConfig = DEPARTMENT_FIELD_CONFIG[key] || DEPARTMENT_FIELD_CONFIG.default;

  return {
    sales: [...COMMON_SALES_FIELDS, ...deptConfig.sales],
    conduct: [...COMMON_CONDUCT_FIELDS, ...deptConfig.conduct],
    contribution: deptConfig.contribution,
  };
};

module.exports = {
  DEPARTMENT_FIELD_CONFIG,
  getFieldConfig,
};