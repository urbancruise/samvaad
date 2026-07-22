const { z } = require("zod");

const {

    PrioritySchema,

    StatusSchema

} = require("../../utils/validation.enums");

const createGoalSchema = z.object({

    assignedToId: z
        .string()
        .min(1, "Employee is required"),

    title: z
        .string()
        .trim()
        .min(3, "Title must be at least 3 characters")
        .max(150),

    description: z
        .string()
        .trim()
        .max(1000)
        .optional()
        .or(z.literal("")),

    priority: PrioritySchema.default("MEDIUM"),

    status: StatusSchema.default("PENDING"),

    startDate: z.coerce.date(),

    dueDate: z.coerce.date(),

    estimatedHours: z
        .coerce
        .number()
        .min(1)
        .max(1000)
        .optional()

}).superRefine((data, ctx) => {

    if (data.dueDate < data.startDate) {

        ctx.addIssue({

            code: z.ZodIssueCode.custom,

            path: ["dueDate"],

            message: "Due date must be after start date"

        });

    }

});

const updateGoalSchema = createGoalSchema.partial();

module.exports = {

    createGoalSchema,

    updateGoalSchema

};