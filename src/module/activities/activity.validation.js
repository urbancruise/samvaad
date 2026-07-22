const { z } = require("zod");
const { parseDate } = require("../../utils/date");
const validateDateString = (val) => {
  if (!val) return true; 
  return !!parseDate(val);
};
const createActivitySchema = z.object({
  taskId: z.string().min(1),

  title: z
    .string()
    .min(3)
    .max(150),

  description: z
    .string()
    .optional(),

  priority: z
    .enum([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ])
    .optional(),

  assignedToId: z
    .number()
    .optional(),

 startDate: z
    .string()
    .optional()
    .refine(validateDateString, { message: "Invalid start date" }),

  dueDate: z
    .string()
    .optional()
    .refine(validateDateString, { message: "Invalid due date" }),

  estimatedMinutes: z
    .number()
    .int()
    .positive()
    .optional(),
});

const updateActivitySchema = createActivitySchema.partial().extend({
  status: z
    .enum([
      "PENDING",
      "COMPLETED",
    ]),
});

module.exports = {
  createActivitySchema,
  updateActivitySchema,
};
