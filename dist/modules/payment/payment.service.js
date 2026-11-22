"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
class PaymentService {
    static async list(params) {
        const where = {
            ...(params?.partyType ? { partyType: params.partyType } : {}),
            ...(params?.partyId
                ? params.partyType === 'FARMER'
                    ? { farmerId: params.partyId }
                    : { millId: params.partyId }
                : {}),
            ...(params?.fromDate || params?.toDate
                ? {
                    paymentDate: {
                        ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
                        ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
                    },
                }
                : {}),
        };
        return database_1.prisma.paymentTransaction.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            include: {
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
    }
    static async create(input, userId) {
        const existing = await database_1.prisma.paymentTransaction.findUnique({
            where: { voucherNumber: input.voucherNumber },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Voucher number '${input.voucherNumber}' already exists`);
        }
        const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
        return database_1.prisma.$transaction(async (tx) => {
            let initialBalance = new client_1.Prisma.Decimal(0);
            if (input.partyType === 'FARMER') {
                const farmer = await tx.farmer.findUnique({ where: { id: input.partyId } });
                if (!farmer)
                    throw new appError_1.NotFoundError('Farmer not found');
                initialBalance = new client_1.Prisma.Decimal(farmer.openingBalance);
            }
            else {
                const mill = await tx.riceMill.findUnique({ where: { id: input.partyId } });
                if (!mill)
                    throw new appError_1.NotFoundError('Rice mill not found');
                initialBalance = new client_1.Prisma.Decimal(mill.openingBalance);
            }
            // 2. Create Payment Transaction
            const payment = await tx.paymentTransaction.create({
                data: {
                    voucherNumber: input.voucherNumber,
                    paymentDate,
                    partyType: input.partyType,
                    farmerId: input.partyType === 'FARMER' ? input.partyId : null,
                    millId: input.partyType === 'RICE_MILL' ? input.partyId : null,
                    amount: new client_1.Prisma.Decimal(input.amount),
                    paymentMode: input.paymentMode,
                    referenceNumber: input.referenceNumber || null,
                    notes: input.notes || null,
                    createdById: userId,
                },
            });
            // 3. Post to the relevant ledger
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: input.partyType === 'FARMER'
                    ? { partyType: 'FARMER', farmerId: input.partyId }
                    : { partyType: 'RICE_MILL', millId: input.partyId },
                orderBy: { transactionDate: 'desc' },
            });
            const prevBalance = lastEntry ? new client_1.Prisma.Decimal(lastEntry.balanceAfter) : initialBalance;
            // When paying Farmer: DEBIT reduces what we owe farmer (Liability - Amount)
            // When receiving from Mill: CREDIT reduces what mill owes us (Asset - Amount)
            const entryType = input.partyType === 'FARMER' ? 'DEBIT' : 'CREDIT';
            const newBalance = prevBalance.minus(input.amount);
            await tx.ledgerEntry.create({
                data: {
                    partyType: input.partyType,
                    farmerId: input.partyType === 'FARMER' ? input.partyId : null,
                    millId: input.partyType === 'RICE_MILL' ? input.partyId : null,
                    transactionDate: paymentDate,
                    entryType,
                    amount: new client_1.Prisma.Decimal(input.amount),
                    balanceAfter: newBalance,
                    referenceType: 'PAYMENT',
                    referenceId: payment.id,
                    description: `${input.partyType === 'FARMER' ? 'Payment to Farmer' : 'Receipt from Rice Mill'} via ${input.paymentMode}${input.referenceNumber ? ` (Ref: ${input.referenceNumber})` : ''}`,
                },
            });
            return payment;
        });
    }
}
exports.PaymentService = PaymentService;
