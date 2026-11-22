import { prisma } from '../../config/database';
import { CreateCategoryInput, CreateExpenseInput } from './expense.schema';
import { NotFoundError, ConflictError } from '../../utils/appError';
import { Prisma } from '@prisma/client';

export class ExpenseService {
  static async listCategories() {
    return prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { expenses: true } },
      },
    });
  }

  static async createCategory(input: CreateCategoryInput) {
    const existing = await prisma.expenseCategory.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictError(`Category '${input.name}' already exists`);
    }
    return prisma.expenseCategory.create({ data: input });
  }

  static async listExpenses(params?: { categoryId?: string; fromDate?: string; toDate?: string }) {
    const where: Prisma.BusinessExpenseWhereInput = {
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

    return prisma.businessExpense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async createExpense(input: CreateExpenseInput, userId: string) {
    const category = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Expense category not found');

    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();

    return prisma.businessExpense.create({
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
