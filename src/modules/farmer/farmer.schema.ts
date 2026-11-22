import { z } from 'zod';

export const createFarmerSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  locality: z.string().min(1).max(100),
  openingBalance: z.number().default(0), // +ve means we owe farmer, -ve means advance
  openingDate: z.string().datetime().optional(),
});

export const updateFarmerSchema = createFarmerSchema.partial().omit({ code: true });

export const farmerAdvanceSchema = z.object({
  amount: z.number().positive('Advance amount must be greater than 0'),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

export type CreateFarmerInput = z.infer<typeof createFarmerSchema>;
export type UpdateFarmerInput = z.infer<typeof updateFarmerSchema>;
export type FarmerAdvanceInput = z.infer<typeof farmerAdvanceSchema>;
