"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmerService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
const ledger_service_1 = require("../ledger/ledger.service");
class FarmerService {
    static async list(search) {
        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                    { locality: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {};
        const farmers = await database_1.prisma.farmer.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { purchases: true, harvesterJobs: true },
                },
            },
        });
        return farmers;
    }
    static async getById(id) {
        const farmer = await database_1.prisma.farmer.findUnique({
            where: { id },
            include: {
                purchases: {
                    orderBy: { purchaseDate: 'desc' },
                    take: 5,
                },
                advances: {
                    orderBy: { date: 'desc' },
                    take: 5,
                },
                harvesterJobs: {
                    orderBy: { workDate: 'desc' },
                    take: 5,
                },
            },
        });
        if (!farmer) {
            throw new appError_1.NotFoundError('Farmer not found');
        }
        return farmer;
    }
    static async create(input) {
        const existing = await database_1.prisma.farmer.findUnique({
            where: { code: input.code },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Farmer with code '${input.code}' already exists`);
        }
        return database_1.prisma.$transaction(async (tx) => {
            const farmer = await tx.farmer.create({
                data: {
                    code: input.code,
                    name: input.name,
                    phone: input.phone,
                    locality: input.locality,
                    openingBalance: input.openingBalance,
                    openingDate: input.openingDate ? new Date(input.openingDate) : new Date(),
                },
            });
            // If there is an opening balance, initialize the ledger entry
            if (input.openingBalance !== 0) {
                await tx.ledgerEntry.create({
                    data: {
                        partyType: 'FARMER',
                        farmerId: farmer.id,
                        transactionDate: farmer.openingDate || new Date(),
                        entryType: input.openingBalance > 0 ? 'CREDIT' : 'DEBIT',
                        amount: new client_1.Prisma.Decimal(Math.abs(input.openingBalance)),
                        balanceAfter: new client_1.Prisma.Decimal(input.openingBalance),
                        referenceType: 'ADJUSTMENT',
                        referenceId: farmer.id,
                        description: 'Opening balance migration',
                    },
                });
            }
            return farmer;
        });
    }
    static async update(id, input) {
        const existing = await this.getById(id);
        if (input.code && input.code !== existing.code) {
            const codeTaken = await database_1.prisma.farmer.findFirst({
                where: { code: input.code, id: { not: id } },
            });
            if (codeTaken) {
                throw new appError_1.ConflictError(`Farmer code '${input.code}' is already assigned to another farmer.`);
            }
        }
        return database_1.prisma.$transaction(async (tx) => {
            const updated = await tx.farmer.update({
                where: { id },
                data: {
                    ...(input.code ? { code: input.code } : {}),
                    ...(input.name ? { name: input.name } : {}),
                    ...(input.phone ? { phone: input.phone } : {}),
                    ...(input.locality ? { locality: input.locality } : {}),
                    ...(input.openingBalance !== undefined
                        ? { openingBalance: new client_1.Prisma.Decimal(input.openingBalance) }
                        : {}),
                    ...(input.openingDate ? { openingDate: new Date(input.openingDate) } : {}),
                },
            });
            // If opening balance was changed, update the initial ledger entry if present
            if (input.openingBalance !== undefined) {
                const openingLedger = await tx.ledgerEntry.findFirst({
                    where: {
                        partyType: 'FARMER',
                        farmerId: id,
                        description: 'Opening balance migration',
                    },
                });
                if (openingLedger) {
                    await tx.ledgerEntry.update({
                        where: { id: openingLedger.id },
                        data: {
                            entryType: input.openingBalance > 0 ? 'CREDIT' : 'DEBIT',
                            amount: new client_1.Prisma.Decimal(Math.abs(input.openingBalance)),
                            balanceAfter: new client_1.Prisma.Decimal(input.openingBalance),
                        },
                    });
                }
                await ledger_service_1.LedgerService.recalculateFarmerLedger(id, tx);
            }
            return updated;
        });
    }
    static async getLedger(farmerId, fromDate, toDate) {
        await this.getById(farmerId);
        const where = {
            partyType: 'FARMER',
            farmerId,
            ...(fromDate || toDate
                ? {
                    transactionDate: {
                        ...(fromDate ? { gte: new Date(fromDate) } : {}),
                        ...(toDate ? { lte: new Date(toDate) } : {}),
                    },
                }
                : {}),
        };
        const entries = await database_1.prisma.ledgerEntry.findMany({
            where,
            orderBy: { transactionDate: 'asc' },
        });
        // Calculate current running balance
        const latestEntry = await database_1.prisma.ledgerEntry.findFirst({
            where: { partyType: 'FARMER', farmerId },
            orderBy: { transactionDate: 'desc' },
        });
        return {
            farmerId,
            currentBalance: latestEntry ? latestEntry.balanceAfter : 0,
            entries,
        };
    }
    static async recordAdvance(farmerId, input, userId) {
        const farmer = await this.getById(farmerId);
        const advanceDate = input.date ? new Date(input.date) : new Date();
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Record Advance
            const advance = await tx.farmerAdvance.create({
                data: {
                    farmerId,
                    amount: input.amount,
                    notes: input.notes,
                    date: advanceDate,
                },
            });
            // 2. Fetch latest balance
            const latestEntry = await tx.ledgerEntry.findFirst({
                where: { partyType: 'FARMER', farmerId },
                orderBy: { transactionDate: 'desc' },
            });
            const currentBalance = latestEntry
                ? new client_1.Prisma.Decimal(latestEntry.balanceAfter)
                : new client_1.Prisma.Decimal(farmer.openingBalance);
            // Paying advance reduces liability (DEBIT)
            const newBalance = currentBalance.minus(input.amount);
            await tx.ledgerEntry.create({
                data: {
                    partyType: 'FARMER',
                    farmerId,
                    transactionDate: advanceDate,
                    entryType: 'DEBIT',
                    amount: new client_1.Prisma.Decimal(input.amount),
                    balanceAfter: newBalance,
                    referenceType: 'PAYMENT',
                    referenceId: advance.id,
                    description: `Pre-harvest advance / cash payment: ${input.notes || ''}`.trim(),
                },
            });
            await ledger_service_1.LedgerService.recalculateFarmerLedger(farmerId, tx);
            return advance;
        });
    }
}
exports.FarmerService = FarmerService;
