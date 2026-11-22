"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
const ledger_service_1 = require("../ledger/ledger.service");
class SettlementService {
    static async list(params) {
        const where = {
            ...(params?.millId ? { millId: params.millId } : {}),
            ...(params?.fromDate || params?.toDate
                ? {
                    receiptDate: {
                        ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
                        ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
                    },
                }
                : {}),
        };
        return database_1.prisma.millSettlement.findMany({
            where,
            orderBy: { receiptDate: 'desc' },
            include: {
                dispatch: true,
                mill: { select: { id: true, name: true, code: true } },
                deductions: true,
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
    }
    static async getById(id) {
        const settlement = await database_1.prisma.millSettlement.findUnique({
            where: { id },
            include: {
                dispatch: {
                    include: {
                        allocations: {
                            include: {
                                lot: {
                                    include: {
                                        purchase: {
                                            include: {
                                                farmer: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                mill: true,
                deductions: true,
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!settlement) {
            throw new appError_1.NotFoundError('Mill settlement record not found');
        }
        return settlement;
    }
    static async create(input, userId) {
        const dispatch = await database_1.prisma.truckDispatch.findUnique({
            where: { id: input.dispatchId },
            include: { mill: true },
        });
        if (!dispatch) {
            throw new appError_1.NotFoundError('Truck dispatch not found');
        }
        const existing = await database_1.prisma.millSettlement.findUnique({
            where: { dispatchId: input.dispatchId },
        });
        if (existing) {
            throw new appError_1.ConflictError('A settlement has already been recorded for this dispatch');
        }
        const receiptDate = input.receiptDate ? new Date(input.receiptDate) : new Date();
        // Dispatched net weight vs Mill received weight
        const dispatchedNetKg = new decimal_js_1.Decimal(dispatch.netWeightKg.toString());
        const receivedKg = new decimal_js_1.Decimal(input.receivedWeightKg);
        const shortageWeightKg = dispatchedNetKg.minus(receivedKg); // Positive means transit loss
        // Calculate deductions
        let finalAcceptedKg = new decimal_js_1.Decimal(receivedKg);
        let totalDeductionsNpr = new decimal_js_1.Decimal(0);
        const calculatedDeductions = [];
        // Step A: First process weight-based deductions
        for (const d of input.deductions) {
            const val = new decimal_js_1.Decimal(d.rateOrValue);
            if (d.type === 'WEIGHT_CUT') {
                finalAcceptedKg = finalAcceptedKg.minus(val);
                const monetaryImpact = input.millRateUnit === 'QUINTAL'
                    ? val.dividedBy(100).times(input.millRate)
                    : val.times(input.millRate);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: val.toDecimalPlaces(3).toNumber(),
                    impactInNpr: monetaryImpact.toDecimalPlaces(2).toNumber(),
                });
            }
            else if (d.type === 'SACK_TARE_CUT') {
                const totalTareCutKg = val.times(input.receivedSacks);
                finalAcceptedKg = finalAcceptedKg.minus(totalTareCutKg);
                const monetaryImpact = input.millRateUnit === 'QUINTAL'
                    ? totalTareCutKg.dividedBy(100).times(input.millRate)
                    : totalTareCutKg.times(input.millRate);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: totalTareCutKg.toDecimalPlaces(3).toNumber(),
                    impactInNpr: monetaryImpact.toDecimalPlaces(2).toNumber(),
                });
            }
            else if (d.type === 'PERCENTAGE_CUT') {
                const percentCutKg = finalAcceptedKg.times(val).dividedBy(100);
                finalAcceptedKg = finalAcceptedKg.minus(percentCutKg);
                const monetaryImpact = input.millRateUnit === 'QUINTAL'
                    ? percentCutKg.dividedBy(100).times(input.millRate)
                    : percentCutKg.times(input.millRate);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: percentCutKg.toDecimalPlaces(3).toNumber(),
                    impactInNpr: monetaryImpact.toDecimalPlaces(2).toNumber(),
                });
            }
        }
        if (finalAcceptedKg.isNegative()) {
            throw new appError_1.BadRequestError('Deductions exceed the total received weight');
        }
        // Step B: Calculate gross settlement on final accepted weight
        const grossSettlementNpr = input.millRateUnit === 'QUINTAL'
            ? finalAcceptedKg.dividedBy(100).times(input.millRate).toDecimalPlaces(2)
            : finalAcceptedKg.times(input.millRate).toDecimalPlaces(2);
        let netPayableByMill = new decimal_js_1.Decimal(grossSettlementNpr);
        // Step C: Process monetary-based deductions
        for (const d of input.deductions) {
            const val = new decimal_js_1.Decimal(d.rateOrValue);
            if (d.type === 'PER_UNIT_RATE_CUT') {
                const moneyCut = input.millRateUnit === 'QUINTAL'
                    ? finalAcceptedKg.dividedBy(100).times(val)
                    : finalAcceptedKg.times(val);
                totalDeductionsNpr = totalDeductionsNpr.plus(moneyCut);
                netPayableByMill = netPayableByMill.minus(moneyCut);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: null,
                    impactInNpr: moneyCut.toDecimalPlaces(2).toNumber(),
                });
            }
            else if (d.type === 'FIXED_MONEY_CUT') {
                totalDeductionsNpr = totalDeductionsNpr.plus(val);
                netPayableByMill = netPayableByMill.minus(val);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: null,
                    impactInNpr: val.toDecimalPlaces(2).toNumber(),
                });
            }
        }
        // Atomic execution: Save settlement, mark dispatch RECONCILED, post to Mill Ledger
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Create Settlement
            const settlement = await tx.millSettlement.create({
                data: {
                    dispatchId: input.dispatchId,
                    millId: dispatch.millId,
                    receiptDate,
                    receivedSacks: input.receivedSacks,
                    receivedWeightKg: input.receivedWeightKg,
                    shortageWeightKg: shortageWeightKg.toDecimalPlaces(3).toNumber(),
                    millRate: input.millRate,
                    millRateUnit: input.millRateUnit,
                    finalAcceptedKg: finalAcceptedKg.toDecimalPlaces(3).toNumber(),
                    grossSettlementNpr: grossSettlementNpr.toNumber(),
                    totalDeductionsNpr: totalDeductionsNpr.toNumber(),
                    netPayableByMill: netPayableByMill.toNumber(),
                    createdById: userId,
                    deductions: {
                        create: calculatedDeductions,
                    },
                },
                include: {
                    deductions: true,
                },
            });
            // 2. Mark Dispatch as RECONCILED
            await tx.truckDispatch.update({
                where: { id: input.dispatchId },
                data: { status: 'RECONCILED' },
            });
            // 3. Post to Mill Ledger (DEBIT = Mill owes us for the delivered paddy)
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: { partyType: 'RICE_MILL', millId: dispatch.millId },
                orderBy: { transactionDate: 'desc' },
            });
            const prevBalance = lastEntry
                ? new client_1.Prisma.Decimal(lastEntry.balanceAfter)
                : new client_1.Prisma.Decimal(dispatch.mill.openingBalance);
            const newBalance = prevBalance.plus(netPayableByMill.toNumber());
            await tx.ledgerEntry.create({
                data: {
                    partyType: 'RICE_MILL',
                    millId: dispatch.millId,
                    transactionDate: receiptDate,
                    entryType: 'DEBIT',
                    amount: new client_1.Prisma.Decimal(netPayableByMill.toNumber()),
                    balanceAfter: newBalance,
                    referenceType: 'SETTLEMENT',
                    referenceId: settlement.id,
                    description: `Dispatch ${dispatch.dispatchNumber} settlement (${finalAcceptedKg.toFixed(2)} kg accepted @ NPR ${input.millRate}/${input.millRateUnit})`,
                },
            });
            await ledger_service_1.LedgerService.recalculateMillLedger(dispatch.millId, tx);
            return settlement;
        });
    }
    static async update(id, input, userId) {
        const existing = await this.getById(id);
        const dispatch = existing.dispatch;
        const receiptDate = input.receiptDate ? new Date(input.receiptDate) : existing.receiptDate;
        const receivedSacks = input.receivedSacks ?? existing.receivedSacks;
        const receivedWeightKg = input.receivedWeightKg ?? Number(existing.receivedWeightKg);
        const millRate = input.millRate ?? Number(existing.millRate);
        const millRateUnit = input.millRateUnit ?? existing.millRateUnit;
        const dispatchedNetKg = new decimal_js_1.Decimal(dispatch.netWeightKg.toString());
        const receivedKg = new decimal_js_1.Decimal(receivedWeightKg);
        const shortageWeightKg = dispatchedNetKg.minus(receivedKg);
        let finalAcceptedKg = new decimal_js_1.Decimal(receivedKg);
        let totalDeductionsNpr = new decimal_js_1.Decimal(0);
        const calculatedDeductions = [];
        const deductionsToProcess = input.deductions !== undefined
            ? input.deductions
            : existing.deductions.map(d => ({ name: d.name, type: d.type, rateOrValue: Number(d.rateOrValue) }));
        for (const d of deductionsToProcess) {
            const val = new decimal_js_1.Decimal(d.rateOrValue);
            if (d.type === 'WEIGHT_CUT') {
                finalAcceptedKg = finalAcceptedKg.minus(val);
                const monetaryImpact = millRateUnit === 'QUINTAL'
                    ? val.dividedBy(100).times(millRate)
                    : val.times(millRate);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: val.toDecimalPlaces(3).toNumber(),
                    impactInNpr: monetaryImpact.toDecimalPlaces(2).toNumber(),
                });
            }
            else if (d.type === 'SACK_TARE_CUT') {
                const totalTareCutKg = val.times(receivedSacks);
                finalAcceptedKg = finalAcceptedKg.minus(totalTareCutKg);
                const monetaryImpact = millRateUnit === 'QUINTAL'
                    ? totalTareCutKg.dividedBy(100).times(millRate)
                    : totalTareCutKg.times(millRate);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: totalTareCutKg.toDecimalPlaces(3).toNumber(),
                    impactInNpr: monetaryImpact.toDecimalPlaces(2).toNumber(),
                });
            }
            else if (d.type === 'PERCENTAGE_CUT') {
                const percentCutKg = finalAcceptedKg.times(val).dividedBy(100);
                finalAcceptedKg = finalAcceptedKg.minus(percentCutKg);
                const monetaryImpact = millRateUnit === 'QUINTAL'
                    ? percentCutKg.dividedBy(100).times(millRate)
                    : percentCutKg.times(millRate);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: percentCutKg.toDecimalPlaces(3).toNumber(),
                    impactInNpr: monetaryImpact.toDecimalPlaces(2).toNumber(),
                });
            }
        }
        if (finalAcceptedKg.isNegative()) {
            throw new appError_1.BadRequestError('Deductions exceed the total received weight');
        }
        const grossSettlementNpr = millRateUnit === 'QUINTAL'
            ? finalAcceptedKg.dividedBy(100).times(millRate).toDecimalPlaces(2)
            : finalAcceptedKg.times(millRate).toDecimalPlaces(2);
        let netPayableByMill = new decimal_js_1.Decimal(grossSettlementNpr);
        for (const d of deductionsToProcess) {
            const val = new decimal_js_1.Decimal(d.rateOrValue);
            if (d.type === 'PER_UNIT_RATE_CUT') {
                const moneyCut = millRateUnit === 'QUINTAL'
                    ? finalAcceptedKg.dividedBy(100).times(val)
                    : finalAcceptedKg.times(val);
                totalDeductionsNpr = totalDeductionsNpr.plus(moneyCut);
                netPayableByMill = netPayableByMill.minus(moneyCut);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: null,
                    impactInNpr: moneyCut.toDecimalPlaces(2).toNumber(),
                });
            }
            else if (d.type === 'FIXED_MONEY_CUT') {
                totalDeductionsNpr = totalDeductionsNpr.plus(val);
                netPayableByMill = netPayableByMill.minus(val);
                calculatedDeductions.push({
                    name: d.name,
                    type: d.type,
                    rateOrValue: d.rateOrValue,
                    impactInKg: null,
                    impactInNpr: val.toDecimalPlaces(2).toNumber(),
                });
            }
        }
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Delete existing deductions and replace if new deductions provided
            if (input.deductions !== undefined) {
                await tx.millDeduction.deleteMany({ where: { settlementId: id } });
            }
            // 2. Update settlement
            const updated = await tx.millSettlement.update({
                where: { id },
                data: {
                    receiptDate,
                    receivedSacks,
                    receivedWeightKg,
                    shortageWeightKg: shortageWeightKg.toDecimalPlaces(3).toNumber(),
                    millRate,
                    millRateUnit,
                    finalAcceptedKg: finalAcceptedKg.toDecimalPlaces(3).toNumber(),
                    grossSettlementNpr: grossSettlementNpr.toNumber(),
                    totalDeductionsNpr: totalDeductionsNpr.toNumber(),
                    netPayableByMill: netPayableByMill.toNumber(),
                    ...(input.deductions !== undefined
                        ? {
                            deductions: {
                                create: calculatedDeductions,
                            },
                        }
                        : {}),
                },
                include: { deductions: true },
            });
            // 3. Update associated ledger entry
            const ledgerEntry = await tx.ledgerEntry.findFirst({
                where: { referenceType: 'SETTLEMENT', referenceId: id },
            });
            if (ledgerEntry) {
                await tx.ledgerEntry.update({
                    where: { id: ledgerEntry.id },
                    data: {
                        transactionDate: receiptDate,
                        amount: new client_1.Prisma.Decimal(netPayableByMill.toNumber()),
                        description: `Dispatch ${dispatch.dispatchNumber} settlement (${finalAcceptedKg.toFixed(2)} kg accepted @ NPR ${millRate}/${millRateUnit}) [Updated]`,
                    },
                });
            }
            // 4. Automatically re-balance mill ledger
            await ledger_service_1.LedgerService.recalculateMillLedger(existing.millId, tx);
            return updated;
        });
    }
    static async delete(id) {
        const existing = await this.getById(id);
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Reset dispatch status
            await tx.truckDispatch.update({
                where: { id: existing.dispatchId },
                data: { status: 'IN_TRANSIT' },
            });
            // 2. Delete deductions
            await tx.millDeduction.deleteMany({ where: { settlementId: id } });
            // 3. Delete ledger entry
            await tx.ledgerEntry.deleteMany({
                where: { referenceType: 'SETTLEMENT', referenceId: id },
            });
            // 4. Delete settlement
            const deleted = await tx.millSettlement.delete({ where: { id } });
            // 5. Recalculate mill ledger
            await ledger_service_1.LedgerService.recalculateMillLedger(existing.millId, tx);
            return deleted;
        });
    }
}
exports.SettlementService = SettlementService;
