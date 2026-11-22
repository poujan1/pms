import { prisma } from '../../config/database';
import { Decimal } from 'decimal.js';

export class ReportService {
  static async getDashboardSummary() {
    // 1. Stock Status
    const lots = await prisma.paddyLot.findMany();
    let totalPurchasedKg = new Decimal(0);
    let totalAllocatedKg = new Decimal(0);
    let totalInWarehouseKg = new Decimal(0);

    for (const lot of lots) {
      totalPurchasedKg = totalPurchasedKg.plus(lot.initialWeightKg.toString());
      totalAllocatedKg = totalAllocatedKg.plus(lot.allocatedWeightKg.toString());
      totalInWarehouseKg = totalInWarehouseKg.plus(lot.remainingWeightKg.toString());
    }

    // 2. Dispatches in transit
    const inTransitDispatches = await prisma.truckDispatch.findMany({
      where: { status: 'IN_TRANSIT' },
    });
    let totalInTransitKg = new Decimal(0);
    for (const d of inTransitDispatches) {
      totalInTransitKg = totalInTransitKg.plus(d.netWeightKg.toString());
    }

    // 3. Purchase Totals
    const purchases = await prisma.paddyPurchase.findMany({
      select: { totalAmount: true },
    });
    let totalPurchaseCostNpr = new Decimal(0);
    for (const p of purchases) {
      totalPurchaseCostNpr = totalPurchaseCostNpr.plus(p.totalAmount.toString());
    }

    // 4. Mill Settlement Totals
    const settlements = await prisma.millSettlement.findMany({
      select: {
        netPayableByMill: true,
        shortageWeightKg: true,
        finalAcceptedKg: true,
      },
    });
    let totalMillSettlementNpr = new Decimal(0);
    let totalShortageKg = new Decimal(0);
    let totalAcceptedByMillsKg = new Decimal(0);

    for (const s of settlements) {
      totalMillSettlementNpr = totalMillSettlementNpr.plus(s.netPayableByMill.toString());
      totalShortageKg = totalShortageKg.plus(s.shortageWeightKg.toString());
      totalAcceptedByMillsKg = totalAcceptedByMillsKg.plus(s.finalAcceptedKg.toString());
    }

    // 5. Total Expenses
    const expenses = await prisma.businessExpense.findMany({
      select: { amount: true },
    });
    let totalOperatingExpensesNpr = new Decimal(0);
    for (const e of expenses) {
      totalOperatingExpensesNpr = totalOperatingExpensesNpr.plus(e.amount.toString());
    }

    // Dispatch transport/labor expenses
    const dispatches = await prisma.truckDispatch.findMany({
      select: { transportCost: true, loadingLaborCost: true, otherExpenses: true },
    });
    let totalDispatchExpensesNpr = new Decimal(0);
    for (const d of dispatches) {
      totalDispatchExpensesNpr = totalDispatchExpensesNpr
        .plus(d.transportCost.toString())
        .plus(d.loadingLaborCost.toString())
        .plus(d.otherExpenses.toString());
    }

    // 6. Outstanding Farmer Liabilities & Mill Receivables
    const farmers = await prisma.farmer.findMany({ select: { id: true } });
    let totalFarmerLiabilityNpr = new Decimal(0);
    for (const f of farmers) {
      const lastEntry = await prisma.ledgerEntry.findFirst({
        where: { partyType: 'FARMER', farmerId: f.id },
        orderBy: { transactionDate: 'desc' },
      });
      if (lastEntry && new Decimal(lastEntry.balanceAfter.toString()).isPositive()) {
        totalFarmerLiabilityNpr = totalFarmerLiabilityNpr.plus(lastEntry.balanceAfter.toString());
      }
    }

    const mills = await prisma.riceMill.findMany({ select: { id: true } });
    let totalMillReceivableNpr = new Decimal(0);
    for (const m of mills) {
      const lastEntry = await prisma.ledgerEntry.findFirst({
        where: { partyType: 'RICE_MILL', millId: m.id },
        orderBy: { transactionDate: 'desc' },
      });
      if (lastEntry && new Decimal(lastEntry.balanceAfter.toString()).isPositive()) {
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
        totalFarmerLiabilitiesNpr: totalFarmerLiabilityNpr.toNumber(),
        totalMillReceivablesNpr: totalMillReceivableNpr.toNumber(),
      },
    };
  }

  static async getDispatchProfitLoss(dispatchId: string) {
    const dispatch = await prisma.truckDispatch.findUnique({
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
    let totalPaddyPurchaseCost = new Decimal(0);
    const lotBreakdown = [];

    for (const alloc of dispatch.allocations) {
      const purchase = alloc.lot.purchase;
      const allocatedKg = new Decimal(alloc.allocatedKg.toString());
      const rate = new Decimal(purchase.rate.toString());
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
    const transportCost = new Decimal(dispatch.transportCost.toString());
    const laborCost = new Decimal(dispatch.loadingLaborCost.toString());
    const otherCost = new Decimal(dispatch.otherExpenses.toString());
    const totalDispatchExpenses = transportCost.plus(laborCost).plus(otherCost);

    // 3. Mill Revenue & Deductions (if settled)
    let millRevenue = new Decimal(0);
    let totalMillDeductions = new Decimal(0);
    let netSettlementNpr = new Decimal(0);
    let shortageKg = new Decimal(0);

    if (dispatch.settlement) {
      millRevenue = new Decimal(dispatch.settlement.grossSettlementNpr.toString());
      totalMillDeductions = new Decimal(dispatch.settlement.totalDeductionsNpr.toString());
      netSettlementNpr = new Decimal(dispatch.settlement.netPayableByMill.toString());
      shortageKg = new Decimal(dispatch.settlement.shortageWeightKg.toString());
    }

    // 4. Profit & Loss Computation
    const totalCost = totalPaddyPurchaseCost.plus(totalDispatchExpenses);
    const grossProfit = dispatch.settlement ? netSettlementNpr.minus(totalPaddyPurchaseCost) : new Decimal(0);
    const netProfit = dispatch.settlement ? netSettlementNpr.minus(totalCost) : new Decimal(0);

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
