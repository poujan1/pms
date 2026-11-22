import { z } from 'zod';

export const createMillSchema = z.object({
  code: z.string().trim().min(1, 'Mill code is required').max(50),
  name: z.string().trim().min(2, 'Mill name is required').max(100),
  contactPerson: z.string().trim().optional().nullable(),
  phone: z.string().trim().min(5, 'Phone must be at least 5 characters').max(20),
  location: z.string().trim().min(1, 'Location is required').max(100),
  openingBalance: z.coerce.number().default(0), // +ve: Mill owes us, -ve: Advance
});

export const updateMillSchema = createMillSchema.partial();

export const createContractSchema = z.object({
  contractNumber: z.string().trim().min(1),
  variety: z.string().trim().min(1),
  targetWeightKg: z.coerce.number().positive(),
  ratePerKg: z.coerce.number().positive(),
  maxMoisture: z.coerce.number().optional().nullable(),
});

export type CreateMillInput = z.infer<typeof createMillSchema>;
export type UpdateMillInput = z.infer<typeof updateMillSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
