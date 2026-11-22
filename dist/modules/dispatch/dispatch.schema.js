"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDispatchSchema = exports.createDispatchSchema = exports.lotAllocationSchema = void 0;
const zod_1 = require("zod");
exports.lotAllocationSchema = zod_1.z.object({
    lotId: zod_1.z.string().uuid(),
    allocatedKg: zod_1.z.number().positive('Allocated kg must be positive'),
    sacksCount: zod_1.z.number().int().positive('Sacks count must be at least 1'),
});
exports.createDispatchSchema = zod_1.z.object({
    dispatchNumber: zod_1.z.string().min(1),
    millId: zod_1.z.string().uuid(),
    contractId: zod_1.z.string().uuid().optional(),
    dispatchDate: zod_1.z.string().datetime().optional(),
    truckNumber: zod_1.z.string().min(1),
    driverName: zod_1.z.string().min(1),
    driverPhone: zod_1.z.string().optional(),
    totalSacks: zod_1.z.number().int().positive(),
    grossWeightKg: zod_1.z.number().positive(),
    tareWeightKg: zod_1.z.number().min(0),
    transportCost: zod_1.z.number().min(0).default(0),
    loadingLaborCost: zod_1.z.number().min(0).default(0),
    otherExpenses: zod_1.z.number().min(0).default(0),
    allocations: zod_1.z.array(exports.lotAllocationSchema).min(1, 'Must allocate at least one lot'),
});
exports.updateDispatchSchema = zod_1.z.object({
    truckNumber: zod_1.z.string().min(1).optional(),
    driverName: zod_1.z.string().min(1).optional(),
    driverPhone: zod_1.z.string().optional(),
    transportCost: zod_1.z.number().min(0).optional(),
    loadingLaborCost: zod_1.z.number().min(0).optional(),
    otherExpenses: zod_1.z.number().min(0).optional(),
    notes: zod_1.z.string().optional(),
});
