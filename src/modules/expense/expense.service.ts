import { prisma } from '../../config/database';
import { CreateCategoryInput, CreateExpenseInput, UpdateExpenseInput } from './expense.schema';
import { NotFoundError, ConflictError } from '../../utils/appError';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

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
      where: { name: input.name.trim() },
    });
    if (existing) {
      throw new ConflictError(`Category '${input.name}' already exists`);
    }
    return prisma.expenseCategory.create({ data: { name: input.name.trim() } });
  }

  static async listExpenses(params?: {
    categoryId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }) {
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

    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { notes: { contains: q, mode: 'insensitive' } },
        { paidTo: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return prisma.businessExpense.findMany({
      where,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async getExpenseSummary(params?: { fromDate?: string; toDate?: string }) {
    const where: Prisma.BusinessExpenseWhereInput = {
      ...(params?.fromDate || params?.toDate
        ? {
            expenseDate: {
              ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
              ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
            },
          }
        : {}),
    };

    const expenses = await prisma.businessExpense.findMany({
      where,
      include: { category: true },
    });

    let totalExpenseNpr = new Decimal(0);
    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; totalAmount: Decimal; count: number }
    >();

    for (const e of expenses) {
      const amt = new Decimal(e.amount.toString());
      totalExpenseNpr = totalExpenseNpr.plus(amt);

      const catId = e.categoryId;
      const catName = e.category.name;
      const existing = categoryMap.get(catId);
      if (existing) {
        existing.totalAmount = existing.totalAmount.plus(amt);
        existing.count += 1;
      } else {
        categoryMap.set(catId, {
          categoryId: catId,
          categoryName: catName,
          totalAmount: amt,
          count: 1,
        });
      }
    }

    const breakdown = Array.from(categoryMap.values())
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        totalAmount: c.totalAmount.toNumber(),
        count: c.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalExpenseNpr: totalExpenseNpr.toNumber(),
      totalCount: expenses.length,
      categoryBreakdown: breakdown,
    };
  }

  static async createExpense(input: CreateExpenseInput, userId: string) {
    let categoryId = input.categoryId;

    if (!categoryId && input.categoryName) {
      const trimmedName = input.categoryName.trim();
      let category = await prisma.expenseCategory.findUnique({
        where: { name: trimmedName },
      });
      if (!category) {
        category = await prisma.expenseCategory.create({
          data: { name: trimmedName },
        });
      }
      categoryId = category.id;
    }

    if (!categoryId) {
      throw new NotFoundError('Expense category is required');
    }

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundError('Expense category not found');

    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();

    return prisma.businessExpense.create({
      data: {
        categoryId,
        expenseDate,
        amount: input.amount,
        paidTo: input.paidTo,
        notes: input.notes,
        createdById: userId,
      },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async updateExpense(id: string, input: UpdateExpenseInput) {
    const existing = await prisma.businessExpense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Expense record not found');

    let categoryId = input.categoryId;

    if (!categoryId && input.categoryName) {
      const trimmedName = input.categoryName.trim();
      let category = await prisma.expenseCategory.findUnique({
        where: { name: trimmedName },
      });
      if (!category) {
        category = await prisma.expenseCategory.create({
          data: { name: trimmedName },
        });
      }
      categoryId = category.id;
    }

    if (categoryId) {
      const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
      if (!cat) throw new NotFoundError('Expense category not found');
    }

    return prisma.businessExpense.update({
      where: { id },
      data: {
        ...(categoryId ? { categoryId } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.paidTo !== undefined ? { paidTo: input.paidTo } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.expenseDate ? { expenseDate: new Date(input.expenseDate) } : {}),
      },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async deleteExpense(id: string) {
    const existing = await prisma.businessExpense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Expense record not found');

    return prisma.businessExpense.delete({
      where: { id },
    });
  }
}
