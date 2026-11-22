"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractSchema = exports.updateMillSchema = exports.createMillSchema = void 0;
const zod_1 = require("zod");
exports.createMillSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1, 'Mill code is required').max(50),
    name: zod_1.z.string().trim().min(2, 'Mill name is required').max(100),
    contactPerson: zod_1.z.string().trim().optional().nullable(),
    phone: zod_1.z.string().trim().min(5, 'Phone must be at least 5 characters').max(20),
    location: zod_1.z.string().trim().min(1, 'Location is required').max(100),
    openingBalance: zod_1.z.coerce.number().default(0), // +ve: Mill owes us, -ve: Advance
});
exports.updateMillSchema = exports.createMillSchema.partial();
exports.createContractSchema = zod_1.z.object({
    contractNumber: zod_1.z.string().trim().min(1),
    variety: zod_1.z.string().trim().min(1),
    targetWeightKg: zod_1.z.coerce.number().positive(),
    ratePerKg: zod_1.z.coerce.number().positive(),
    maxMoisture: zod_1.z.coerce.number().optional().nullable(),
});
