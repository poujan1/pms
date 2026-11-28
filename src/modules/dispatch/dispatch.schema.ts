import { z } from 'zod';

export const lotAllocationSchema = z.object({
  lotId: z.string().uuid('Invalid lot identifier'),
  allocatedKg: z.number().positive('Allocated kg must be positive'),
  sacksCount: z.number().int().positive('Sacks count must be at least 1'),
});

export const createDispatchSchema = z.object({
  dispatchNumber: z.string().min(1, 'Dispatch number is required'),
  millId: z.string().uuid('Please select a valid destination rice mill'),
  contractId: z.string().uuid().optional().nullable(),
  dispatchDate: z.string().optional().nullable(),
  truckNumber: z.string().min(1, 'Truck number is required'),
  driverName: z.string().min(1, 'Driver name is required'),
  driverPhone: z.string().optional().nullable(),
  totalSacks: z.number().int().positive('Total sacks must be at least 1'),
  grossWeightKg: z.number().positive('Gross weight must be positive'),
  tareWeightKg: z.number().min(0, 'Tare weight cannot be negative'),
  transportCost: z.number().min(0).default(0),
  loadingLaborCost: z.number().min(0).default(0),
  otherExpenses: z.number().min(0).default(0),
  allocations: z.array(lotAllocationSchema).min(1, 'Must allocate at least one lot'),
});

export const updateDispatchSchema = z.object({
  truckNumber: z.string().min(1).optional(),
  driverName: z.string().min(1).optional(),
  driverPhone: z.string().optional().nullable(),
  transportCost: z.number().min(0).optional(),
  loadingLaborCost: z.number().min(0).optional(),
  otherExpenses: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type UpdateDispatchInput = z.infer<typeof updateDispatchSchema>;
