import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
});

export const createExpenseSchema = z
  .object({
    categoryId: z.string().uuid().optional().nullable(),
    categoryName: z.string().min(1).max(100).optional().nullable(),
    expenseDate: z.string().optional().nullable(),
    amount: z.number().positive('Expense amount must be greater than 0'),
    paidTo: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((data) => data.categoryId || data.categoryName, {
    message: 'Either categoryId or categoryName must be provided',
  });

export const updateExpenseSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  categoryName: z.string().min(1).max(100).optional().nullable(),
  expenseDate: z.string().optional().nullable(),
  amount: z.number().positive('Expense amount must be greater than 0').optional(),
  paidTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
