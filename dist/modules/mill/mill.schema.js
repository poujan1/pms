"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractSchema = exports.updateMillSchema = exports.createMillSchema = void 0;
const zod_1 = require("zod");
exports.createMillSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(50),
    name: zod_1.z.string().min(2).max(100),
    contactPerson: zod_1.z.string().optional(),
    phone: zod_1.z.string().min(5).max(20),
    location: zod_1.z.string().min(1).max(100),
    openingBalance: zod_1.z.number().default(0), // +ve: Mill owes us, -ve: Advance
});
exports.updateMillSchema = exports.createMillSchema.partial().omit({ code: true });
exports.createContractSchema = zod_1.z.object({
    contractNumber: zod_1.z.string().min(1),
    variety: zod_1.z.string().min(1),
    targetWeightKg: zod_1.z.number().positive(),
    ratePerKg: zod_1.z.number().positive(),
    maxMoisture: zod_1.z.number().optional(),
});
