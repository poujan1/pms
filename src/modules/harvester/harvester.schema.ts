import { z } from 'zod';
import { HarvesterChargeHandling } from '@prisma/client';

export const createMachineSchema = z.object({
  name: z.string().min(1).max(100),
  operatorName: z.string().min(1).max(100),
  operatorPhone: z.string().optional(),
});

export const logHarvesterWorkSchema = z.object({
  workDate: z.string().optional().nullable(),
  farmerId: z.string().uuid(),
  machineId: z.string().uuid(),
  landArea: z.string().optional().nullable(),
  durationMinutes: z.number().int().positive('Duration in minutes must be > 0').optional().nullable(),
  hourlyRate: z.number().positive('Hourly rate must be > 0').optional().nullable(),
  workQuantity: z.number().positive('Work quantity must be > 0').optional().nullable(),
  ratePerUnit: z.number().positive('Rate must be > 0').optional().nullable(),
  chargeHandling: z.nativeEnum(HarvesterChargeHandling),
  purchaseId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>;
export type LogHarvesterWorkInput = z.infer<typeof logHarvesterWorkSchema>;
