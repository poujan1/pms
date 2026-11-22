import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const createExpenseSchema = z.object({
  categoryId: z.string().uuid(),
  expenseDate: z.string().datetime().optional(),
  amount: z.number().positive('Expense amount must be greater than 0'),
  paidTo: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
