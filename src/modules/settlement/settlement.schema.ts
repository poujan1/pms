import { z } from 'zod';
import { DeductionType, RateUnit } from '@prisma/client';

export const deductionItemSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(DeductionType),
  rateOrValue: z.number().min(0),
});

export const createSettlementSchema = z.object({
  dispatchId: z.string().uuid(),
  receiptDate: z.string().optional().nullable(),
  receivedSacks: z.number().int().positive(),
  receivedWeightKg: z.number().positive(),
  millRate: z.number().positive(),
  millRateUnit: z.nativeEnum(RateUnit).default(RateUnit.KG),
  deductions: z.array(deductionItemSchema).default([]),
});

export const updateSettlementSchema = createSettlementSchema.partial().omit({ dispatchId: true });

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>;
