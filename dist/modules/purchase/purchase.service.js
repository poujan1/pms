"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const numberUtils_1 = require("../../utils/numberUtils");
const client_1 = require("@prisma/client");
class PurchaseService {
    static async list(params) {
        const where = {
            ...(params?.farmerId ? { farmerId: params.farmerId } : {}),
            ...(params?.fromDate || params?.toDate
                ? {
                    purchaseDate: {
                        ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
                        ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
                    },
                }
                : {}),
            ...(params?.search
                ? {
                    OR: [
                        { purchaseNumber: { contains: params.search, mode: 'insensitive' } },
                        { farmer: { name: { contains: params.search, mode: 'insensitive' } } },
                        { variety: { contains: params.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        return database_1.prisma.paddyPurchase.findMany({
            where,
            orderBy: { purchaseDate: 'desc' },
            include: {
                farmer: { select: { id: true, name: true, code: true, phone: true } },
                lot: true,
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
    }
    static async getById(id) {
        const purchase = await database_1.prisma.paddyPurchase.findUnique({
            where: { id },
            include: {
                farmer: true,
                lot: {
                    include: {
                        dispatchAllocations: {
                            include: {
                                dispatch: true,
                            },
                        },
                    },
                },
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!purchase) {
            throw new appError_1.NotFoundError('Purchase record not found');
        }
        return purchase;
    }
    static async create(input, userId) {
        const farmer = await database_1.prisma.farmer.findUnique({ where: { id: input.farmerId } });
        if (!farmer)
            throw new appError_1.NotFoundError('Farmer not found');
        const existing = await database_1.prisma.paddyPurchase.findUnique({
            where: { purchaseNumber: input.purchaseNumber },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Purchase number '${input.purchaseNumber}' is already in use`);
        }
        const netWeight = (0, numberUtils_1.calculateNetWeight)(input.grossWeightKg, input.sackTareWeightKg);
        if (netWeight.isZero()) {
            throw new appError_1.BadRequestError('Net weight cannot be zero');
        }
        const totalAmount = (0, numberUtils_1.calculatePurchaseAmount)(netWeight, input.rate, input.rateUnit);
        const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : new Date();
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Create Purchase Record
            const purchase = await tx.paddyPurchase.create({
                data: {
                    purchaseNumber: input.purchaseNumber,
                    farmerId: input.farmerId,
                    purchaseDate,
                    variety: input.variety,
                    fieldLocation: input.fieldLocation,
                    sackCount: input.sackCount,
                    grossWeightKg: input.grossWeightKg,
                    sackTareWeightKg: input.sackTareWeightKg,
                    netWeightKg: netWeight.toNumber(),
                    rate: input.rate,
                    rateUnit: input.rateUnit,
                    totalAmount: totalAmount.toNumber(),
                    notes: input.notes,
                    createdById: userId,
                },
            });
            // 2. Initialize Stock Lot for Traceability
            const lot = await tx.paddyLot.create({
                data: {
                    lotNumber: `LOT-${input.purchaseNumber}`,
                    purchaseId: purchase.id,
                    initialWeightKg: netWeight.toNumber(),
                    remainingWeightKg: netWeight.toNumber(),
                },
            });
            // 3. Post to Farmer Ledger (CREDIT = We owe farmer for paddy)
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: { partyType: 'FARMER', farmerId: input.farmerId },
                orderBy: { transactionDate: 'desc' },
            });
            const prevBalance = lastEntry
                ? new client_1.Prisma.Decimal(lastEntry.balanceAfter)
                : new client_1.Prisma.Decimal(farmer.openingBalance);
            const newBalance = prevBalance.plus(totalAmount.toNumber());
            await tx.ledgerEntry.create({
                data: {
                    partyType: 'FARMER',
                    farmerId: input.farmerId,
                    transactionDate: purchaseDate,
                    entryType: 'CREDIT',
                    amount: new client_1.Prisma.Decimal(totalAmount.toNumber()),
                    balanceAfter: newBalance,
                    referenceType: 'PURCHASE',
                    referenceId: purchase.id,
                    description: `Paddy Purchase (${input.sackCount} sacks, Net ${netWeight} kg @ NPR ${input.rate}/${input.rateUnit})`,
                },
            });
            return { ...purchase, lot };
        });
    }
}
exports.PurchaseService = PurchaseService;
