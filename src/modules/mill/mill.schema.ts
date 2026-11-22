import { z } from 'zod';

export const createMillSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(100),
  contactPerson: z.string().optional(),
  phone: z.string().min(5).max(20),
  location: z.string().min(1).max(100),
  openingBalance: z.number().default(0), // +ve: Mill owes us, -ve: Advance
});

export const updateMillSchema = createMillSchema.partial().omit({ code: true });

export const createContractSchema = z.object({
  contractNumber: z.string().min(1),
  variety: z.string().min(1),
  targetWeightKg: z.number().positive(),
  ratePerKg: z.number().positive(),
  maxMoisture: z.number().optional(),
});

export type CreateMillInput = z.infer<typeof createMillSchema>;
export type UpdateMillInput = z.infer<typeof updateMillSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
