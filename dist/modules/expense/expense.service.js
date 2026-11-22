"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
class ExpenseService {
    static async listCategories() {
        return database_1.prisma.expenseCategory.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { expenses: true } },
            },
        });
    }
    static async createCategory(input) {
        const existing = await database_1.prisma.expenseCategory.findUnique({
            where: { name: input.name },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Category '${input.name}' already exists`);
        }
        return database_1.prisma.expenseCategory.create({ data: input });
    }
    static async listExpenses(params) {
        const where = {
            ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
            ...(params?.fromDate || params?.toDate
                ? {
                    expenseDate: {
                        ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
                        ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
                    },
                }
                : {}),
        };
        return database_1.prisma.businessExpense.findMany({
            where,
            orderBy: { expenseDate: 'desc' },
            include: {
                category: true,
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
    }
    static async createExpense(input, userId) {
        const category = await database_1.prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
        if (!category)
            throw new appError_1.NotFoundError('Expense category not found');
        const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();
        return database_1.prisma.businessExpense.create({
            data: {
                categoryId: input.categoryId,
                expenseDate,
                amount: input.amount,
                paidTo: input.paidTo,
                notes: input.notes,
                createdById: userId,
            },
            include: {
                category: true,
            },
        });
    }
}
exports.ExpenseService = ExpenseService;
