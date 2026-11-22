"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdjustmentSchema = exports.statementQuerySchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.statementQuerySchema = zod_1.z.object({
    fromDate: zod_1.z.string().optional().nullable(),
    toDate: zod_1.z.string().optional().nullable(),
});
exports.createAdjustmentSchema = zod_1.z.object({
    partyType: zod_1.z.nativeEnum(client_1.PartyType),
    partyId: zod_1.z.string().uuid(),
    entryType: zod_1.z.nativeEnum(client_1.EntryType), // DEBIT or CREDIT
    amount: zod_1.z.number().positive('Adjustment amount must be positive'),
    date: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().min(3, 'Detailed description is required for audit trail'),
});
