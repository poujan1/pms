import { z } from 'zod';
import { PartyType, EntryType } from '@prisma/client';

export const statementQuerySchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export const createAdjustmentSchema = z.object({
  partyType: z.nativeEnum(PartyType),
  partyId: z.string().uuid(),
  entryType: z.nativeEnum(EntryType), // DEBIT or CREDIT
  amount: z.number().positive('Adjustment amount must be positive'),
  date: z.string().datetime().optional(),
  description: z.string().min(3, 'Detailed description is required for audit trail'),
});

export type StatementQueryInput = z.infer<typeof statementQuerySchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
