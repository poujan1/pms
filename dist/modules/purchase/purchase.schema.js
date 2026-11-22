"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createPurchaseSchema = zod_1.z.object({
    purchaseNumber: zod_1.z.string().min(1),
    farmerId: zod_1.z.string().uuid(),
    purchaseDate: zod_1.z.string().datetime().optional(),
    variety: zod_1.z.string().optional(),
    fieldLocation: zod_1.z.string().optional(),
    sackCount: zod_1.z.number().int().positive('Sack count must be at least 1'),
    grossWeightKg: zod_1.z.number().positive('Gross weight must be positive'),
    sackTareWeightKg: zod_1.z.number().min(0, 'Tare weight cannot be negative'),
    rate: zod_1.z.number().positive('Rate must be positive'),
    rateUnit: zod_1.z.nativeEnum(client_1.RateUnit).default(client_1.RateUnit.KG),
    notes: zod_1.z.string().optional(),
});
