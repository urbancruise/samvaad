const { z } = require("zod");

const validateDateString = (val) => {
  if (!val) return true; 
  return !!Date.parse(val); 
};

const createGoalSchema = z.object({
  title: z.string().min(3).max(150),

  description: z.string().optional(),

  goalType: z.enum([
    "LONG_TERM",
    "ONGOING",
    "URGENT",
  ]),

  priority: z.enum([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
  ]).optional(),

  startDate: z
    .string()
    .refine(validateDateString, { message: "Invalid start date" }),

  dueDate: z
    .string()
    .refine(validateDateString, { message: "Invalid due date" }),

  status: z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]).optional(),


 assignedToId: z.number().int().optional(),
  status: z.enum([
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
  ]).optional(),
});

const updateGoalSchema = createGoalSchema.partial();

module.exports = {
  createGoalSchema,
  updateGoalSchema,
};