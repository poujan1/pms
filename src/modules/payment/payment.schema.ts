import { z } from 'zod';
import { PartyType, PaymentMode } from '@prisma/client';

export const createPaymentSchema = z.object({
  voucherNumber: z.string().min(1),
  paymentDate: z.string().datetime().optional(),
  partyType: z.nativeEnum(PartyType),
  partyId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
