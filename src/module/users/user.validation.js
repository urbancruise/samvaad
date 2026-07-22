const { z } = require("zod");

const registerSchema = z.object({
    fullName: z
        .string()
        .trim()
        .min(3, "Full name is required"),

    username: z
        .string()
        .trim()
        .min(3)
        .max(30),

    email: z
        .string()
        .email(),

    password: z
        .string()
        .min(8, "Password should contain minimum 8 characters"),

    role: z.enum([
        "ADMIN",
        "MANAGER",
        "TEAM_LEAD",
        "EMPLOYEE",
    ]),

    managerId: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const changePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
});

module.exports = {
    registerSchema,
    loginSchema,
    changePasswordSchema,
};