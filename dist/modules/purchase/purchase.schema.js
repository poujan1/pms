"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePurchaseSchema = exports.createPurchaseSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createPurchaseSchema = zod_1.z.object({
    purchaseNumber: zod_1.z.string().min(1),
    farmerId: zod_1.z.string().uuid(),
    purchaseDate: zod_1.z.string().optional().nullable(),
    variety: zod_1.z.string().optional(),
    fieldLocation: zod_1.z.string().optional(),
    sackCount: zod_1.z.number().int().positive('Sack count must be at least 1'),
    grossWeightKg: zod_1.z.number().positive('Gross weight must be positive'),
    sackTareWeightKg: zod_1.z.number().min(0, 'Tare weight cannot be negative'),
    rate: zod_1.z.number().positive('Rate must be positive'),
    rateUnit: zod_1.z.nativeEnum(client_1.RateUnit).default(client_1.RateUnit.KG),
    notes: zod_1.z.string().optional(),
    harvester: zod_1.z
        .object({
        machineId: zod_1.z.string().uuid(),
        landArea: zod_1.z.string().optional().nullable(),
        durationMinutes: zod_1.z.number().int().positive('Duration must be greater than 0 minutes'),
        hourlyRate: zod_1.z.number().positive('Hourly rate must be greater than 0'),
        chargeHandling: zod_1.z.nativeEnum(client_1.HarvesterChargeHandling).default(client_1.HarvesterChargeHandling.FARMER_DEDUCTION),
        notes: zod_1.z.string().optional().nullable(),
    })
        .optional()
        .nullable(),
});
exports.updatePurchaseSchema = exports.createPurchaseSchema.partial();
