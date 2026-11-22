"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.farmerAdvanceSchema = exports.updateFarmerSchema = exports.createFarmerSchema = void 0;
const zod_1 = require("zod");
exports.createFarmerSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1, 'Farmer code is required').max(50),
    name: zod_1.z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    phone: zod_1.z.string().trim().min(5, 'Phone must be at least 5 characters').max(20),
    locality: zod_1.z.string().trim().min(1, 'Locality is required').max(100),
    openingBalance: zod_1.z.coerce.number().default(0), // +ve means we owe farmer, -ve means advance
    openingDate: zod_1.z.string().optional().nullable(),
});
exports.updateFarmerSchema = exports.createFarmerSchema.partial();
exports.farmerAdvanceSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive('Advance amount must be greater than 0'),
    notes: zod_1.z.string().optional(),
    date: zod_1.z.string().optional().nullable(),
});
