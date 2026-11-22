import { z } from 'zod';

export const createFarmerSchema = z.object({
  code: z.string().trim().min(1, 'Farmer code is required').max(50),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().min(5, 'Phone must be at least 5 characters').max(20),
  locality: z.string().trim().min(1, 'Locality is required').max(100),
  openingBalance: z.coerce.number().default(0), // +ve means we owe farmer, -ve means advance
  openingDate: z.string().optional().nullable(),
});

export const updateFarmerSchema = createFarmerSchema.partial();

export const farmerAdvanceSchema = z.object({
  amount: z.coerce.number().positive('Advance amount must be greater than 0'),
  notes: z.string().optional(),
  date: z.string().optional().nullable(),
});

export type CreateFarmerInput = z.infer<typeof createFarmerSchema>;
export type UpdateFarmerInput = z.infer<typeof updateFarmerSchema>;
export type FarmerAdvanceInput = z.infer<typeof farmerAdvanceSchema>;
