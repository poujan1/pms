"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExpenseSchema = exports.createExpenseSchema = exports.createCategorySchema = void 0;
const zod_1 = require("zod");
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
});
exports.createExpenseSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid(),
    expenseDate: zod_1.z.string().datetime().optional(),
    amount: zod_1.z.number().positive('Expense amount must be greater than 0'),
    paidTo: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.updateExpenseSchema = exports.createExpenseSchema.partial();
