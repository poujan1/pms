"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const numberUtils_1 = require("../../utils/numberUtils");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
const ledger_service_1 = require("../ledger/ledger.service");
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
                harvesterWorks: {
                    include: {
                        machine: { select: { id: true, name: true, operatorName: true } },
                    },
                },
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
                harvesterWorks: {
                    include: {
                        machine: { select: { id: true, name: true, operatorName: true } },
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
            // 4. If Harvester machine was used during harvest of this paddy:
            let harvesterWork = null;
            if (input.harvester) {
                const machine = await tx.harvesterMachine.findUnique({
                    where: { id: input.harvester.machineId },
                });
                if (!machine)
                    throw new appError_1.NotFoundError('Harvester Machine not found');
                const durationMinutes = input.harvester.durationMinutes;
                const hourlyRate = input.harvester.hourlyRate;
                const durationHours = new decimal_js_1.Decimal(durationMinutes).dividedBy(60);
                const harvesterCharge = durationHours.times(new decimal_js_1.Decimal(hourlyRate)).toDecimalPlaces(2);
                harvesterWork = await tx.harvesterWork.create({
                    data: {
                        workDate: purchaseDate,
                        farmerId: input.farmerId,
                        machineId: input.harvester.machineId,
                        purchaseId: purchase.id,
                        landArea: input.harvester.landArea ?? null,
                        durationMinutes,
                        hourlyRate,
                        workQuantity: durationHours.toDecimalPlaces(2).toNumber(),
                        ratePerUnit: hourlyRate,
                        totalCharge: harvesterCharge.toNumber(),
                        chargeHandling: input.harvester.chargeHandling,
                        notes: input.harvester.notes ?? `Harvesting for Purchase ${purchase.purchaseNumber}`,
                    },
                });
                if (input.harvester.chargeHandling === 'FARMER_DEDUCTION') {
                    // Debit farmer ledger for harvester deduction
                    const timeDesc = `${durationMinutes} mins`;
                    const landDesc = input.harvester.landArea ? ` [${input.harvester.landArea}]` : '';
                    await tx.ledgerEntry.create({
                        data: {
                            partyType: 'FARMER',
                            farmerId: input.farmerId,
                            transactionDate: purchaseDate,
                            entryType: 'DEBIT',
                            amount: new client_1.Prisma.Decimal(harvesterCharge.toNumber()),
                            balanceAfter: newBalance.minus(harvesterCharge.toNumber()),
                            referenceType: 'HARVESTER',
                            referenceId: harvesterWork.id,
                            description: `Harvester deduction for Paddy ${purchase.purchaseNumber} (${timeDesc}${landDesc} @ NPR ${hourlyRate}/hr - ${machine.name})`,
                        },
                    });
                }
                else {
                    // Company expense: Cost from our pocket, audited on main expense ledger
                    let category = await tx.expenseCategory.findUnique({
                        where: { name: 'Harvesting Machinery' },
                    });
                    if (!category) {
                        category = await tx.expenseCategory.create({
                            data: {
                                name: 'Harvesting Machinery',
                            },
                        });
                    }
                    const timeDesc = `${durationMinutes} mins`;
                    const landDesc = input.harvester.landArea ? ` [${input.harvester.landArea}]` : '';
                    await tx.businessExpense.create({
                        data: {
                            categoryId: category.id,
                            expenseDate: purchaseDate,
                            amount: new client_1.Prisma.Decimal(harvesterCharge.toNumber()),
                            paidTo: machine.operatorName,
                            notes: `Harvester cost (${timeDesc}${landDesc} - ${machine.name}) for Purchase ${purchase.purchaseNumber}`,
                            createdById: userId,
                        },
                    });
                }
            }
            await ledger_service_1.LedgerService.recalculateFarmerLedger(input.farmerId, tx);
            return { ...purchase, lot, harvesterWork };
        });
    }
    static async update(id, input) {
        const existing = await this.getById(id);
        return database_1.prisma.$transaction(async (tx) => {
            const grossWeight = input.grossWeightKg ?? Number(existing.grossWeightKg);
            const tareWeight = input.sackTareWeightKg ?? Number(existing.sackTareWeightKg);
            const netWeight = (0, numberUtils_1.calculateNetWeight)(grossWeight, tareWeight);
            const rate = input.rate ?? Number(existing.rate);
            const rateUnit = input.rateUnit ?? existing.rateUnit;
            const totalAmount = (0, numberUtils_1.calculatePurchaseAmount)(netWeight, rate, rateUnit);
            const newFarmerId = input.farmerId ?? existing.farmerId;
            const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : existing.purchaseDate;
            const updated = await tx.paddyPurchase.update({
                where: { id },
                data: {
                    farmerId: newFarmerId,
                    variety: input.variety ?? existing.variety,
                    fieldLocation: input.fieldLocation ?? existing.fieldLocation,
                    sackCount: input.sackCount ?? existing.sackCount,
                    grossWeightKg: grossWeight,
                    sackTareWeightKg: tareWeight,
                    netWeightKg: netWeight.toNumber(),
                    rate,
                    rateUnit,
                    totalAmount: totalAmount.toNumber(),
                    notes: input.notes !== undefined ? input.notes : existing.notes,
                    purchaseDate,
                },
            });
            // Update associated lot weight
            const lot = await tx.paddyLot.findFirst({ where: { purchaseId: id } });
            if (lot) {
                const diff = netWeight.toNumber() - Number(lot.initialWeightKg);
                await tx.paddyLot.update({
                    where: { id: lot.id },
                    data: {
                        initialWeightKg: netWeight.toNumber(),
                        remainingWeightKg: Math.max(0, Number(lot.remainingWeightKg) + diff),
                    },
                });
            }
            // Update corresponding ledger entry
            const ledgerEntry = await tx.ledgerEntry.findFirst({
                where: { referenceType: 'PURCHASE', referenceId: id },
            });
            if (ledgerEntry) {
                await tx.ledgerEntry.update({
                    where: { id: ledgerEntry.id },
                    data: {
                        farmerId: newFarmerId,
                        transactionDate: purchaseDate,
                        amount: new client_1.Prisma.Decimal(totalAmount.toNumber()),
                        description: `Paddy Purchase (${updated.sackCount} sacks, Net ${netWeight} kg @ NPR ${rate}/${rateUnit}) [Updated]`,
                    },
                });
            }
            // Automatically recalculate and balance farmer's ledger
            await ledger_service_1.LedgerService.recalculateFarmerLedger(newFarmerId, tx);
            if (newFarmerId !== existing.farmerId) {
                await ledger_service_1.LedgerService.recalculateFarmerLedger(existing.farmerId, tx);
            }
            return updated;
        });
    }
    static async delete(id) {
        const existing = await this.getById(id);
        const lot = await database_1.prisma.paddyLot.findFirst({
            where: { purchaseId: id },
            include: { dispatchAllocations: true },
        });
        if (lot && lot.dispatchAllocations.length > 0) {
            throw new appError_1.BadRequestError('Cannot delete purchase because its stock lot is already allocated to dispatches. Please remove or adjust the dispatches first.');
        }
        return database_1.prisma.$transaction(async (tx) => {
            if (lot) {
                await tx.paddyLot.delete({ where: { id: lot.id } });
            }
            await tx.ledgerEntry.deleteMany({
                where: { referenceType: 'PURCHASE', referenceId: id },
            });
            const deleted = await tx.paddyPurchase.delete({ where: { id } });
            await ledger_service_1.LedgerService.recalculateFarmerLedger(existing.farmerId, tx);
            return deleted;
        });
    }
}
exports.PurchaseService = PurchaseService;
