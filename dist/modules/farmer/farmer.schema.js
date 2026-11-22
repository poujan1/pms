"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.farmerAdvanceSchema = exports.updateFarmerSchema = exports.createFarmerSchema = void 0;
const zod_1 = require("zod");
exports.createFarmerSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(50),
    name: zod_1.z.string().min(2).max(100),
    phone: zod_1.z.string().min(5).max(20),
    locality: zod_1.z.string().min(1).max(100),
    openingBalance: zod_1.z.number().default(0), // +ve means we owe farmer, -ve means advance
    openingDate: zod_1.z.string().datetime().optional(),
});
exports.updateFarmerSchema = exports.createFarmerSchema.partial();
exports.farmerAdvanceSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Advance amount must be greater than 0'),
    notes: zod_1.z.string().optional(),
    date: zod_1.z.string().datetime().optional(),
});
