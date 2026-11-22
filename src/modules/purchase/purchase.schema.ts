import { z } from 'zod';
import { RateUnit } from '@prisma/client';

export const createPurchaseSchema = z.object({
  purchaseNumber: z.string().min(1),
  farmerId: z.string().uuid(),
  purchaseDate: z.string().optional().nullable(),
  variety: z.string().optional(),
  fieldLocation: z.string().optional(),
  sackCount: z.number().int().positive('Sack count must be at least 1'),
  grossWeightKg: z.number().positive('Gross weight must be positive'),
  sackTareWeightKg: z.number().min(0, 'Tare weight cannot be negative'),
  rate: z.number().positive('Rate must be positive'),
  rateUnit: z.nativeEnum(RateUnit).default(RateUnit.KG),
  notes: z.string().optional(),
});

export const updatePurchaseSchema = createPurchaseSchema.partial();

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
