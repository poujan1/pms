"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSettlementSchema = exports.deductionItemSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.deductionItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    type: zod_1.z.nativeEnum(client_1.DeductionType),
    rateOrValue: zod_1.z.number().min(0),
});
exports.createSettlementSchema = zod_1.z.object({
    dispatchId: zod_1.z.string().uuid(),
    receiptDate: zod_1.z.string().optional().nullable(),
    receivedSacks: zod_1.z.number().int().positive(),
    receivedWeightKg: zod_1.z.number().positive(),
    millRate: zod_1.z.number().positive(),
    millRateUnit: zod_1.z.nativeEnum(client_1.RateUnit).default(client_1.RateUnit.KG),
    deductions: zod_1.z.array(exports.deductionItemSchema).default([]),
});
