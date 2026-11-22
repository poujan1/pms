import { z } from 'zod';

export const lotAllocationSchema = z.object({
  lotId: z.string().uuid(),
  allocatedKg: z.number().positive('Allocated kg must be positive'),
  sacksCount: z.number().int().positive('Sacks count must be at least 1'),
});

export const createDispatchSchema = z.object({
  dispatchNumber: z.string().min(1),
  millId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  dispatchDate: z.string().optional().nullable(),
  truckNumber: z.string().min(1),
  driverName: z.string().min(1),
  driverPhone: z.string().optional(),
  totalSacks: z.number().int().positive(),
  grossWeightKg: z.number().positive(),
  tareWeightKg: z.number().min(0),
  transportCost: z.number().min(0).default(0),
  loadingLaborCost: z.number().min(0).default(0),
  otherExpenses: z.number().min(0).default(0),
  allocations: z.array(lotAllocationSchema).min(1, 'Must allocate at least one lot'),
});

export const updateDispatchSchema = z.object({
  truckNumber: z.string().min(1).optional(),
  driverName: z.string().min(1).optional(),
  driverPhone: z.string().optional(),
  transportCost: z.number().min(0).optional(),
  loadingLaborCost: z.number().min(0).optional(),
  otherExpenses: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type UpdateDispatchInput = z.infer<typeof updateDispatchSchema>;
