const { z } = require("zod");

const PrioritySchema = z.enum([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

const StatusSchema = z.enum([
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED"
]);

module.exports = {

    PrioritySchema,

    StatusSchema

};