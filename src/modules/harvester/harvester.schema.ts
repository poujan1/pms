import { z } from 'zod';
import { HarvesterChargeHandling } from '@prisma/client';

export const createMachineSchema = z.object({
  name: z.string().min(1).max(100),
  operatorName: z.string().min(1).max(100),
  operatorPhone: z.string().optional(),
});

export const logHarvesterWorkSchema = z.object({
  workDate: z.string().datetime().optional(),
  farmerId: z.string().uuid(),
  machineId: z.string().uuid(),
  workQuantity: z.number().positive('Work quantity must be greater than 0'),
  ratePerUnit: z.number().positive('Rate must be greater than 0'),
  chargeHandling: z.nativeEnum(HarvesterChargeHandling),
  notes: z.string().optional(),
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>;
export type LogHarvesterWorkInput = z.infer<typeof logHarvesterWorkSchema>;
