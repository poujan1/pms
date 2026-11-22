"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentSchema = exports.createPaymentSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createPaymentSchema = zod_1.z.object({
    voucherNumber: zod_1.z.string().min(1, 'Voucher number is required'),
    paymentDate: zod_1.z.string().optional().nullable(),
    partyType: zod_1.z.nativeEnum(client_1.PartyType),
    partyId: zod_1.z.string().min(1, 'Party ID is required'),
    amount: zod_1.z.coerce.number().positive('Payment amount must be greater than 0'),
    paymentMode: zod_1.z.nativeEnum(client_1.PaymentMode).default(client_1.PaymentMode.CASH),
    referenceNumber: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
});
exports.updatePaymentSchema = exports.createPaymentSchema.partial().omit({ partyId: true, partyType: true });
