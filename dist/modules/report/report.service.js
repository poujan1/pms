"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const database_1 = require("../../config/database");
const decimal_js_1 = require("decimal.js");
const ledger_service_1 = require("../ledger/ledger.service");
class ReportService {
    static async getDashboardSummary() {
        // 1. Stock Status
        const lots = await database_1.prisma.paddyLot.findMany();
        let totalPurchasedKg = new decimal_js_1.Decimal(0);
        let totalAllocatedKg = new decimal_js_1.Decimal(0);
        let totalInWarehouseKg = new decimal_js_1.Decimal(0);
        for (const lot of lots) {
            totalPurchasedKg = totalPurchasedKg.plus(lot.initialWeightKg.toString());
            totalAllocatedKg = totalAllocatedKg.plus(lot.allocatedWeightKg.toString());
            totalInWarehouseKg = totalInWarehouseKg.plus(lot.remainingWeightKg.toString());
        }
        // 2. Dispatches in transit
        const inTransitDispatches = await database_1.prisma.truckDispatch.findMany({
            where: { status: 'IN_TRANSIT' },
        });
        let totalInTransitKg = new decimal_js_1.Decimal(0);
        for (const d of inTransitDispatches) {
            totalInTransitKg = totalInTransitKg.plus(d.netWeightKg.toString());
        }
        // 3. Purchase Totals
        const purchases = await database_1.prisma.paddyPurchase.findMany({
            select: { totalAmount: true },
        });
        let totalPurchaseCostNpr = new decimal_js_1.Decimal(0);
        for (const p of purchases) {
            totalPurchaseCostNpr = totalPurchaseCostNpr.plus(p.totalAmount.toString());
        }
        // 4. Mill Settlement Totals
        const settlements = await database_1.prisma.millSettlement.findMany({
            select: {
                netPayableByMill: true,
                shortageWeightKg: true,
                finalAcceptedKg: true,
            },
        });
        let totalMillSettlementNpr = new decimal_js_1.Decimal(0);
        let totalShortageKg = new decimal_js_1.Decimal(0);
        let totalAcceptedByMillsKg = new decimal_js_1.Decimal(0);
        for (const s of settlements) {
            totalMillSettlementNpr = totalMillSettlementNpr.plus(s.netPayableByMill.toString());
            totalShortageKg = totalShortageKg.plus(s.shortageWeightKg.toString());
            totalAcceptedByMillsKg = totalAcceptedByMillsKg.plus(s.finalAcceptedKg.toString());
        }
        // 5. Total Expenses
        const expenses = await database_1.prisma.businessExpense.findMany({
            select: { amount: true },
        });
        let totalOperatingExpensesNpr = new decimal_js_1.Decimal(0);
        for (const e of expenses) {
            totalOperatingExpensesNpr = totalOperatingExpensesNpr.plus(e.amount.toString());
        }
        // Dispatch transport/labor expenses
        const dispatches = await database_1.prisma.truckDispatch.findMany({
            select: { transportCost: true, loadingLaborCost: true, otherExpenses: true },
        });
        let totalDispatchExpensesNpr = new decimal_js_1.Decimal(0);
        for (const d of dispatches) {
            totalDispatchExpensesNpr = totalDispatchExpensesNpr
                .plus(d.transportCost.toString())
                .plus(d.loadingLaborCost.toString())
                .plus(d.otherExpenses.toString());
        }
        // 6. Outstanding Farmer Liabilities & Mill Receivables
        const farmersSummary = await ledger_service_1.LedgerService.getAllFarmersLedgerSummary();
        let totalFarmerPurchasesNpr = new decimal_js_1.Decimal(0);
        let totalFarmerPaidNpr = new decimal_js_1.Decimal(0);
        let totalFarmerRemainingDueNpr = new decimal_js_1.Decimal(0);
        let totalFarmerAdvancesNpr = new decimal_js_1.Decimal(0);
        let clearedFarmersCount = 0;
        let unpaidFarmersCount = 0;
        let advanceFarmersCount = 0;
        for (const f of farmersSummary) {
            totalFarmerPurchasesNpr = totalFarmerPurchasesNpr.plus(f.totalPurchasedAmountNpr);
            totalFarmerPaidNpr = totalFarmerPaidNpr.plus(f.totalPaidNpr);
            if (f.paymentStatus === 'CLEARED') {
                clearedFarmersCount++;
            }
            else if (f.paymentStatus === 'ADVANCE') {
                advanceFarmersCount++;
                totalFarmerAdvancesNpr = totalFarmerAdvancesNpr.plus(Math.abs(f.currentNetBalance));
            }
            else {
                unpaidFarmersCount++;
                totalFarmerRemainingDueNpr = totalFarmerRemainingDueNpr.plus(f.remainingDueNpr);
            }
        }
        const mills = await database_1.prisma.riceMill.findMany({ select: { id: true } });
        let totalMillReceivableNpr = new decimal_js_1.Decimal(0);
        for (const m of mills) {
            const lastEntry = await database_1.prisma.ledgerEntry.findFirst({
                where: { partyType: 'RICE_MILL', millId: m.id },
                orderBy: { transactionDate: 'desc' },
            });
            if (lastEntry && new decimal_js_1.Decimal(lastEntry.balanceAfter.toString()).isPositive()) {
                totalMillReceivableNpr = totalMillReceivableNpr.plus(lastEntry.balanceAfter.toString());
            }
        }
        return {
            inventory: {
                totalPurchasedKg: totalPurchasedKg.toNumber(),
                totalInWarehouseKg: totalInWarehouseKg.toNumber(),
                totalInTransitKg: totalInTransitKg.toNumber(),
                totalAcceptedByMillsKg: totalAcceptedByMillsKg.toNumber(),
                totalShortageKg: totalShortageKg.toNumber(),
            },
            financials: {
                totalPurchaseCostNpr: totalPurchaseCostNpr.toNumber(),
                totalMillRevenueNpr: totalMillSettlementNpr.toNumber(),
                totalOperatingExpensesNpr: totalOperatingExpensesNpr.toNumber(),
                totalDispatchExpensesNpr: totalDispatchExpensesNpr.toNumber(),
                totalFarmerLiabilitiesNpr: totalFarmerRemainingDueNpr.toNumber(),
                totalMillReceivablesNpr: totalMillReceivableNpr.toNumber(),
            },
            farmerPayments: {
                totalFarmerPurchasesNpr: totalFarmerPurchasesNpr.toNumber(),
                totalFarmerPaidNpr: totalFarmerPaidNpr.toNumber(),
                totalFarmerRemainingDueNpr: totalFarmerRemainingDueNpr.toNumber(),
                totalFarmerAdvancesNpr: totalFarmerAdvancesNpr.toNumber(),
                clearedFarmersCount,
                unpaidFarmersCount,
                advanceFarmersCount,
                totalFarmersCount: farmersSummary.length,
            },
        };
    }
    static async getDispatchProfitLoss(dispatchId) {
        const dispatch = await database_1.prisma.truckDispatch.findUnique({
            where: { id: dispatchId },
            include: {
                mill: true,
                settlement: {
                    include: { deductions: true },
                },
                allocations: {
                    include: {
                        lot: {
                            include: {
                                purchase: {
                                    include: { farmer: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!dispatch) {
            throw new Error('Dispatch not found');
        }
        // 1. Calculate Procurement Cost of the allocated grain
        let totalPaddyPurchaseCost = new decimal_js_1.Decimal(0);
        const lotBreakdown = [];
        for (const alloc of dispatch.allocations) {
            const purchase = alloc.lot.purchase;
            const allocatedKg = new decimal_js_1.Decimal(alloc.allocatedKg.toString());
            const rate = new decimal_js_1.Decimal(purchase.rate.toString());
            const effectiveRatePerKg = purchase.rateUnit === 'QUINTAL' ? rate.dividedBy(100) : rate;
            const costForThisAlloc = allocatedKg.times(effectiveRatePerKg);
            totalPaddyPurchaseCost = totalPaddyPurchaseCost.plus(costForThisAlloc);
            lotBreakdown.push({
                lotNumber: alloc.lot.lotNumber,
                farmerName: purchase.farmer.name,
                allocatedKg: allocatedKg.toNumber(),
                purchaseRatePerKg: effectiveRatePerKg.toNumber(),
                procurementCost: costForThisAlloc.toDecimalPlaces(2).toNumber(),
            });
        }
        // 2. Logistics & Handling Cost
        const transportCost = new decimal_js_1.Decimal(dispatch.transportCost.toString());
        const laborCost = new decimal_js_1.Decimal(dispatch.loadingLaborCost.toString());
        const otherCost = new decimal_js_1.Decimal(dispatch.otherExpenses.toString());
        const totalDispatchExpenses = transportCost.plus(laborCost).plus(otherCost);
        // 3. Mill Revenue & Deductions (if settled)
        let millRevenue = new decimal_js_1.Decimal(0);
        let totalMillDeductions = new decimal_js_1.Decimal(0);
        let netSettlementNpr = new decimal_js_1.Decimal(0);
        let shortageKg = new decimal_js_1.Decimal(0);
        if (dispatch.settlement) {
            millRevenue = new decimal_js_1.Decimal(dispatch.settlement.grossSettlementNpr.toString());
            totalMillDeductions = new decimal_js_1.Decimal(dispatch.settlement.totalDeductionsNpr.toString());
            netSettlementNpr = new decimal_js_1.Decimal(dispatch.settlement.netPayableByMill.toString());
            shortageKg = new decimal_js_1.Decimal(dispatch.settlement.shortageWeightKg.toString());
        }
        // 4. Profit & Loss Computation
        const totalCost = totalPaddyPurchaseCost.plus(totalDispatchExpenses);
        const grossProfit = dispatch.settlement ? netSettlementNpr.minus(totalPaddyPurchaseCost) : new decimal_js_1.Decimal(0);
        const netProfit = dispatch.settlement ? netSettlementNpr.minus(totalCost) : new decimal_js_1.Decimal(0);
        return {
            dispatchId: dispatch.id,
            dispatchNumber: dispatch.dispatchNumber,
            dispatchDate: dispatch.dispatchDate,
            truckNumber: dispatch.truckNumber,
            millName: dispatch.mill.name,
            status: dispatch.status,
            weights: {
                dispatchedNetKg: Number(dispatch.netWeightKg),
                receivedKg: dispatch.settlement ? Number(dispatch.settlement.receivedWeightKg) : null,
                acceptedKg: dispatch.settlement ? Number(dispatch.settlement.finalAcceptedKg) : null,
                shortageKg: shortageKg.toNumber(),
            },
            costs: {
                paddyPurchaseCost: totalPaddyPurchaseCost.toDecimalPlaces(2).toNumber(),
                transportCost: transportCost.toNumber(),
                laborCost: laborCost.toNumber(),
                otherCost: otherCost.toNumber(),
                totalExpenses: totalDispatchExpenses.toNumber(),
                totalCost: totalCost.toDecimalPlaces(2).toNumber(),
            },
            revenue: dispatch.settlement
                ? {
                    millRate: Number(dispatch.settlement.millRate),
                    millRateUnit: dispatch.settlement.millRateUnit,
                    grossRevenue: millRevenue.toNumber(),
                    totalDeductions: totalMillDeductions.toNumber(),
                    netRevenue: netSettlementNpr.toNumber(),
                    deductionsList: dispatch.settlement.deductions,
                }
                : null,
            profitability: dispatch.settlement
                ? {
                    grossProfitNpr: grossProfit.toDecimalPlaces(2).toNumber(),
                    netProfitNpr: netProfit.toDecimalPlaces(2).toNumber(),
                    profitMarginPercent: netSettlementNpr.isZero()
                        ? 0
                        : netProfit.dividedBy(netSettlementNpr).times(100).toDecimalPlaces(2).toNumber(),
                }
                : null,
            lotAllocations: lotBreakdown,
        };
    }
}
exports.ReportService = ReportService;
