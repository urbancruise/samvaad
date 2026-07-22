const { z } = require("zod");
const { parseDate } = require("../../utils/date");
const validateDateString = (val) => {
  if (!val) return true; 
  return !!parseDate(val);
};
const createTaskSchema = z.object({
  goalId: z.string().min(1),

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

  status: z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]).optional(),
});


const updateTaskSchema =
  createTaskSchema.partial();

module.exports = {
  createTaskSchema,
  updateTaskSchema,
};
