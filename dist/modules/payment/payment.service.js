"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
const ledger_service_1 = require("../ledger/ledger.service");
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
    static async getById(id) {
        const payment = await database_1.prisma.paymentTransaction.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!payment) {
            throw new appError_1.NotFoundError('Payment transaction not found');
        }
        return payment;
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
            if (input.partyType === 'FARMER') {
                await ledger_service_1.LedgerService.recalculateFarmerLedger(input.partyId, tx);
            }
            else {
                await ledger_service_1.LedgerService.recalculateMillLedger(input.partyId, tx);
            }
            return payment;
        });
    }
    static async update(id, input) {
        const existing = await this.getById(id);
        return database_1.prisma.$transaction(async (tx) => {
            const paymentDate = input.paymentDate ? new Date(input.paymentDate) : existing.paymentDate;
            const amount = input.amount !== undefined ? new client_1.Prisma.Decimal(input.amount) : existing.amount;
            const paymentMode = input.paymentMode ?? existing.paymentMode;
            const referenceNumber = input.referenceNumber !== undefined ? input.referenceNumber : existing.referenceNumber;
            const notes = input.notes !== undefined ? input.notes : existing.notes;
            const updated = await tx.paymentTransaction.update({
                where: { id },
                data: {
                    paymentDate,
                    amount,
                    paymentMode,
                    referenceNumber,
                    notes,
                },
            });
            const ledgerEntry = await tx.ledgerEntry.findFirst({
                where: { referenceType: 'PAYMENT', referenceId: id },
            });
            if (ledgerEntry) {
                await tx.ledgerEntry.update({
                    where: { id: ledgerEntry.id },
                    data: {
                        transactionDate: paymentDate,
                        amount,
                        description: `${existing.partyType === 'FARMER' ? 'Payment to Farmer' : 'Receipt from Rice Mill'} via ${paymentMode}${referenceNumber ? ` (Ref: ${referenceNumber})` : ''} [Updated]`,
                    },
                });
            }
            if (existing.partyType === 'FARMER' && existing.farmerId) {
                await ledger_service_1.LedgerService.recalculateFarmerLedger(existing.farmerId, tx);
            }
            else if (existing.partyType === 'RICE_MILL' && existing.millId) {
                await ledger_service_1.LedgerService.recalculateMillLedger(existing.millId, tx);
            }
            return updated;
        });
    }
    static async delete(id) {
        const existing = await this.getById(id);
        return database_1.prisma.$transaction(async (tx) => {
            await tx.ledgerEntry.deleteMany({
                where: { referenceType: 'PAYMENT', referenceId: id },
            });
            const deleted = await tx.paymentTransaction.delete({ where: { id } });
            if (existing.partyType === 'FARMER' && existing.farmerId) {
                await ledger_service_1.LedgerService.recalculateFarmerLedger(existing.farmerId, tx);
            }
            else if (existing.partyType === 'RICE_MILL' && existing.millId) {
                await ledger_service_1.LedgerService.recalculateMillLedger(existing.millId, tx);
            }
            return deleted;
        });
    }
}
exports.PaymentService = PaymentService;
