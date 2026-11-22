import { z } from 'zod';
import { PartyType, PaymentMode } from '@prisma/client';

export const createPaymentSchema = z.object({
  voucherNumber: z.string().min(1, 'Voucher number is required'),
  paymentDate: z.string().optional().nullable(),
  partyType: z.nativeEnum(PartyType),
  partyId: z.string().min(1, 'Party ID is required'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updatePaymentSchema = createPaymentSchema.partial().omit({ partyId: true, partyType: true });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
