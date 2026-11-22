"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
class LedgerService {
    /**
     * Recalculates all running balances for a farmer's ledger in chronological order.
     * Ensures that balanceAfter on every entry is exact, and returns the current closing balance.
     */
    static async recalculateFarmerLedger(farmerId, tx) {
        const db = tx ?? database_1.prisma;
        const farmer = await db.farmer.findUnique({
            where: { id: farmerId },
            select: { openingBalance: true },
        });
        if (!farmer)
            return new decimal_js_1.Decimal(0);
        const entries = await db.ledgerEntry.findMany({
            where: { partyType: "FARMER", farmerId },
            orderBy: [
                { transactionDate: "asc" },
                { createdAt: "asc" },
                { id: "asc" },
            ],
        });
        const hasOpeningMigration = entries.some((e) => e.referenceType === "ADJUSTMENT" &&
            e.description.toLowerCase().includes("opening balance"));
        let currentBalance = hasOpeningMigration
            ? new decimal_js_1.Decimal(0)
            : new decimal_js_1.Decimal(farmer.openingBalance.toString());
        for (const entry of entries) {
            const amt = new decimal_js_1.Decimal(entry.amount.toString());
            if (entry.entryType === "CREDIT") {
                currentBalance = currentBalance.plus(amt);
            }
            else {
                currentBalance = currentBalance.minus(amt);
            }
            const currentStored = new decimal_js_1.Decimal(entry.balanceAfter.toString());
            if (!currentStored.equals(currentBalance)) {
                await db.ledgerEntry.update({
                    where: { id: entry.id },
                    data: { balanceAfter: new client_1.Prisma.Decimal(currentBalance.toNumber()) },
                });
            }
        }
        return currentBalance;
    }
    /**
     * Recalculates all running balances for a rice mill's ledger in chronological order.
     * Ensures that balanceAfter on every entry is exact, and returns the current closing balance.
     */
    static async recalculateMillLedger(millId, tx) {
        const db = tx ?? database_1.prisma;
        const mill = await db.riceMill.findUnique({
            where: { id: millId },
            select: { openingBalance: true },
        });
        if (!mill)
            return new decimal_js_1.Decimal(0);
        const entries = await db.ledgerEntry.findMany({
            where: { partyType: "RICE_MILL", millId },
            orderBy: [
                { transactionDate: "asc" },
                { createdAt: "asc" },
                { id: "asc" },
            ],
        });
        const hasOpeningMigration = entries.some((e) => e.referenceType === "ADJUSTMENT" &&
            e.description.toLowerCase().includes("opening balance"));
        let currentBalance = hasOpeningMigration
            ? new decimal_js_1.Decimal(0)
            : new decimal_js_1.Decimal(mill.openingBalance.toString());
        for (const entry of entries) {
            const amt = new decimal_js_1.Decimal(entry.amount.toString());
            // For Mill: DEBIT is receivable (we billed mill for delivered paddy), CREDIT is payment received
            if (entry.entryType === "DEBIT") {
                currentBalance = currentBalance.plus(amt);
            }
            else {
                currentBalance = currentBalance.minus(amt);
            }
            const currentStored = new decimal_js_1.Decimal(entry.balanceAfter.toString());
            if (!currentStored.equals(currentBalance)) {
                await db.ledgerEntry.update({
                    where: { id: entry.id },
                    data: { balanceAfter: new client_1.Prisma.Decimal(currentBalance.toNumber()) },
                });
            }
        }
        return currentBalance;
    }
    /**
     * Complete date-wise Farmer Account Statement with Period Opening & Closing Balances
     */
    static async getFarmerStatement(farmerId, fromDate, toDate) {
        const farmer = await database_1.prisma.farmer.findUnique({
            where: { id: farmerId },
            include: {
                _count: {
                    select: { purchases: true, advances: true, harvesterJobs: true },
                },
            },
        });
        if (!farmer) {
            throw new appError_1.NotFoundError("Farmer not found");
        }
        const startDate = fromDate ? new Date(fromDate) : undefined;
        const endDate = toDate ? new Date(toDate) : undefined;
        const allFarmerEntries = await database_1.prisma.ledgerEntry.findMany({
            where: { partyType: "FARMER", farmerId },
            select: { referenceType: true, description: true },
        });
        const hasOpeningMigration = allFarmerEntries.some((e) => e.referenceType === "ADJUSTMENT" &&
            e.description.toLowerCase().includes("opening balance"));
        let periodOpeningBalance = hasOpeningMigration
            ? new decimal_js_1.Decimal(0)
            : new decimal_js_1.Decimal(farmer.openingBalance.toString());
        if (startDate) {
            const priorEntries = await database_1.prisma.ledgerEntry.findMany({
                where: {
                    partyType: "FARMER",
                    farmerId,
                    transactionDate: { lt: startDate },
                },
                orderBy: [
                    { transactionDate: "asc" },
                    { createdAt: "asc" },
                    { id: "asc" },
                ],
            });
            for (const entry of priorEntries) {
                const amt = new decimal_js_1.Decimal(entry.amount.toString());
                // For farmers: CREDIT increases liability (we owe them), DEBIT decreases it (paid/deducted)
                if (entry.entryType === "CREDIT") {
                    periodOpeningBalance = periodOpeningBalance.plus(amt);
                }
                else {
                    periodOpeningBalance = periodOpeningBalance.minus(amt);
                }
            }
        }
        // 2. Fetch all entries within the requested period
        const periodEntries = await database_1.prisma.ledgerEntry.findMany({
            where: {
                partyType: "FARMER",
                farmerId,
                ...(startDate || endDate
                    ? {
                        transactionDate: {
                            ...(startDate ? { gte: startDate } : {}),
                            ...(endDate ? { lte: endDate } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: { transactionDate: "asc" },
        });
        // 3. Build line items with running balance
        let currentBalance = new decimal_js_1.Decimal(periodOpeningBalance);
        let totalDebitInPeriod = new decimal_js_1.Decimal(0);
        let totalCreditInPeriod = new decimal_js_1.Decimal(0);
        const lineItems = periodEntries.map((entry) => {
            const amt = new decimal_js_1.Decimal(entry.amount.toString());
            if (entry.entryType === "CREDIT") {
                currentBalance = currentBalance.plus(amt);
                totalCreditInPeriod = totalCreditInPeriod.plus(amt);
            }
            else {
                currentBalance = currentBalance.minus(amt);
                totalDebitInPeriod = totalDebitInPeriod.plus(amt);
            }
            return {
                id: entry.id,
                date: entry.transactionDate,
                referenceType: entry.referenceType,
                referenceId: entry.referenceId,
                description: entry.description,
                debit: entry.entryType === "DEBIT" ? amt.toNumber() : 0,
                credit: entry.entryType === "CREDIT" ? amt.toNumber() : 0,
                runningBalance: currentBalance.toNumber(),
            };
        });
        return {
            party: {
                id: farmer.id,
                code: farmer.code,
                name: farmer.name,
                phone: farmer.phone,
                locality: farmer.locality,
            },
            period: {
                fromDate: startDate ? startDate.toISOString() : null,
                toDate: endDate ? endDate.toISOString() : null,
            },
            summary: {
                initialSystemOpeningBalance: Number(farmer.openingBalance),
                periodOpeningBalance: periodOpeningBalance.toNumber(),
                totalDebitInPeriod: totalDebitInPeriod.toNumber(),
                totalCreditInPeriod: totalCreditInPeriod.toNumber(),
                closingBalance: currentBalance.toNumber(),
                netStatus: currentBalance.greaterThanOrEqualTo(0)
                    ? "PAYABLE_TO_FARMER"
                    : "RECEIVABLE_FROM_FARMER",
            },
            lineItems,
        };
    }
    /**
     * Complete date-wise Rice Mill Account Statement with Period Opening & Closing Balances
     */
    static async getMillStatement(millId, fromDate, toDate) {
        const mill = await database_1.prisma.riceMill.findUnique({
            where: { id: millId },
            include: {
                _count: {
                    select: { dispatches: true, settlements: true, contracts: true },
                },
            },
        });
        if (!mill) {
            throw new appError_1.NotFoundError("Rice mill not found");
        }
        const startDate = fromDate ? new Date(fromDate) : undefined;
        const endDate = toDate ? new Date(toDate) : undefined;
        const allMillEntries = await database_1.prisma.ledgerEntry.findMany({
            where: { partyType: "RICE_MILL", millId },
            select: { referenceType: true, description: true },
        });
        const hasOpeningMigration = allMillEntries.some((e) => e.referenceType === "ADJUSTMENT" &&
            e.description.toLowerCase().includes("opening balance"));
        // 1. Calculate Period Opening Balance (all transactions before `fromDate`)
        let periodOpeningBalance = hasOpeningMigration
            ? new decimal_js_1.Decimal(0)
            : new decimal_js_1.Decimal(mill.openingBalance.toString());
        if (startDate) {
            const priorEntries = await database_1.prisma.ledgerEntry.findMany({
                where: {
                    partyType: "RICE_MILL",
                    millId,
                    transactionDate: { lt: startDate },
                },
                orderBy: [
                    { transactionDate: "asc" },
                    { createdAt: "asc" },
                    { id: "asc" },
                ],
            });
            for (const entry of priorEntries) {
                const amt = new decimal_js_1.Decimal(entry.amount.toString());
                // For mills: DEBIT increases receivable (mill owes us for paddy), CREDIT decreases it (mill paid us)
                if (entry.entryType === "DEBIT") {
                    periodOpeningBalance = periodOpeningBalance.plus(amt);
                }
                else {
                    periodOpeningBalance = periodOpeningBalance.minus(amt);
                }
            }
        }
        // 2. Fetch all entries within the requested period
        const periodEntries = await database_1.prisma.ledgerEntry.findMany({
            where: {
                partyType: "RICE_MILL",
                millId,
                ...(startDate || endDate
                    ? {
                        transactionDate: {
                            ...(startDate ? { gte: startDate } : {}),
                            ...(endDate ? { lte: endDate } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: { transactionDate: "asc" },
        });
        // 3. Build line items with running balance
        let currentBalance = new decimal_js_1.Decimal(periodOpeningBalance);
        let totalDebitInPeriod = new decimal_js_1.Decimal(0);
        let totalCreditInPeriod = new decimal_js_1.Decimal(0);
        const lineItems = periodEntries.map((entry) => {
            const amt = new decimal_js_1.Decimal(entry.amount.toString());
            if (entry.entryType === "DEBIT") {
                currentBalance = currentBalance.plus(amt);
                totalDebitInPeriod = totalDebitInPeriod.plus(amt);
            }
            else {
                currentBalance = currentBalance.minus(amt);
                totalCreditInPeriod = totalCreditInPeriod.plus(amt);
            }
            return {
                id: entry.id,
                date: entry.transactionDate,
                referenceType: entry.referenceType,
                referenceId: entry.referenceId,
                description: entry.description,
                debit: entry.entryType === "DEBIT" ? amt.toNumber() : 0,
                credit: entry.entryType === "CREDIT" ? amt.toNumber() : 0,
                runningBalance: currentBalance.toNumber(),
            };
        });
        return {
            party: {
                id: mill.id,
                code: mill.code,
                name: mill.name,
                contactPerson: mill.contactPerson,
                phone: mill.phone,
                location: mill.location,
            },
            period: {
                fromDate: startDate ? startDate.toISOString() : null,
                toDate: endDate ? endDate.toISOString() : null,
            },
            summary: {
                initialSystemOpeningBalance: Number(mill.openingBalance),
                periodOpeningBalance: periodOpeningBalance.toNumber(),
                totalDebitInPeriod: totalDebitInPeriod.toNumber(), // Total billed to mill
                totalCreditInPeriod: totalCreditInPeriod.toNumber(), // Total payments received
                closingBalance: currentBalance.toNumber(),
                netStatus: currentBalance.greaterThanOrEqualTo(0)
                    ? "RECEIVABLE_FROM_MILL"
                    : "ADVANCE_FROM_MILL",
            },
            lineItems,
        };
    }
    /**
     * Summary overview of every Farmer's net financial balance
     */
    static async getAllFarmersLedgerSummary() {
        const farmers = await database_1.prisma.farmer.findMany({
            orderBy: { name: "asc" },
            include: {
                purchases: {
                    select: { netWeightKg: true, totalAmount: true },
                },
                advances: {
                    select: { amount: true },
                },
                harvesterJobs: {
                    where: { chargeHandling: "FARMER_DEDUCTION" },
                    select: { totalCharge: true },
                },
                payments: {
                    select: { amount: true },
                },
            },
        });
        const summary = [];
        for (const f of farmers) {
            let totalPaddyKg = new decimal_js_1.Decimal(0);
            let totalPaddyNpr = new decimal_js_1.Decimal(0);
            for (const p of f.purchases) {
                totalPaddyKg = totalPaddyKg.plus(p.netWeightKg.toString());
                totalPaddyNpr = totalPaddyNpr.plus(p.totalAmount.toString());
            }
            let totalAdvancesNpr = new decimal_js_1.Decimal(0);
            for (const a of f.advances) {
                totalAdvancesNpr = totalAdvancesNpr.plus(a.amount.toString());
            }
            let totalDirectPaymentsNpr = new decimal_js_1.Decimal(0);
            for (const pay of f.payments) {
                totalDirectPaymentsNpr = totalDirectPaymentsNpr.plus(pay.amount.toString());
            }
            const totalPaidNpr = totalDirectPaymentsNpr.plus(totalAdvancesNpr);
            let totalHarvesterCutsNpr = new decimal_js_1.Decimal(0);
            for (const h of f.harvesterJobs) {
                totalHarvesterCutsNpr = totalHarvesterCutsNpr.plus(h.totalCharge.toString());
            }
            // Fetch latest running balance from Ledger
            const latestEntry = await database_1.prisma.ledgerEntry.findFirst({
                where: { partyType: "FARMER", farmerId: f.id },
                orderBy: [
                    { transactionDate: "desc" },
                    { createdAt: "desc" },
                    { id: "desc" },
                ],
            });
            const currentBalance = latestEntry
                ? Number(latestEntry.balanceAfter)
                : Number(f.openingBalance);
            const remainingDueNpr = currentBalance > 0.01 ? currentBalance : 0;
            let paymentStatus;
            if (Math.abs(currentBalance) <= 0.01) {
                paymentStatus = "CLEARED";
            }
            else if (currentBalance > 0.01) {
                paymentStatus = totalPaidNpr.greaterThan(0) ? "PARTIAL" : "UNPAID";
            }
            else {
                paymentStatus = "ADVANCE";
            }
            summary.push({
                farmerId: f.id,
                code: f.code,
                name: f.name,
                phone: f.phone,
                locality: f.locality,
                openingBalance: Number(f.openingBalance),
                totalPurchasedKg: totalPaddyKg.toNumber(),
                totalPurchasedAmountNpr: totalPaddyNpr.toNumber(),
                totalAdvancesNpr: totalAdvancesNpr.toNumber(),
                totalPaidNpr: totalPaidNpr.toNumber(),
                remainingDueNpr,
                totalHarvesterDeductionsNpr: totalHarvesterCutsNpr.toNumber(),
                currentNetBalance: currentBalance,
                status: currentBalance >= 0 ? "PAYABLE" : "ADVANCE_RECEIVABLE",
                paymentStatus,
            });
        }
        return summary;
    }
    /**
     * Summary overview of every Mill's net receivables and transit metrics
     */
    static async getAllMillsLedgerSummary() {
        const mills = await database_1.prisma.riceMill.findMany({
            orderBy: { name: "asc" },
            include: {
                dispatches: {
                    select: { netWeightKg: true, status: true },
                },
                settlements: {
                    select: {
                        finalAcceptedKg: true,
                        shortageWeightKg: true,
                        grossSettlementNpr: true,
                        totalDeductionsNpr: true,
                        netPayableByMill: true,
                    },
                },
                payments: {
                    select: { amount: true },
                },
            },
        });
        const summary = [];
        for (const m of mills) {
            let totalDispatchedKg = new decimal_js_1.Decimal(0);
            for (const d of m.dispatches) {
                totalDispatchedKg = totalDispatchedKg.plus(d.netWeightKg.toString());
            }
            let totalAcceptedKg = new decimal_js_1.Decimal(0);
            let totalShortageKg = new decimal_js_1.Decimal(0);
            let totalNetSettlementNpr = new decimal_js_1.Decimal(0);
            let totalSideCutsNpr = new decimal_js_1.Decimal(0);
            for (const s of m.settlements) {
                totalAcceptedKg = totalAcceptedKg.plus(s.finalAcceptedKg.toString());
                totalShortageKg = totalShortageKg.plus(s.shortageWeightKg.toString());
                totalNetSettlementNpr = totalNetSettlementNpr.plus(s.netPayableByMill.toString());
                totalSideCutsNpr = totalSideCutsNpr.plus(s.totalDeductionsNpr.toString());
            }
            let totalReceivedNpr = new decimal_js_1.Decimal(0);
            for (const pay of m.payments) {
                totalReceivedNpr = totalReceivedNpr.plus(pay.amount.toString());
            }
            const latestEntry = await database_1.prisma.ledgerEntry.findFirst({
                where: { partyType: "RICE_MILL", millId: m.id },
                orderBy: [
                    { transactionDate: "desc" },
                    { createdAt: "desc" },
                    { id: "desc" },
                ],
            });
            const currentBalance = latestEntry
                ? Number(latestEntry.balanceAfter)
                : Number(m.openingBalance);
            const remainingDueNpr = currentBalance > 0.01 ? currentBalance : 0;
            let paymentStatus;
            if (Math.abs(currentBalance) <= 0.01) {
                paymentStatus = "CLEARED";
            }
            else if (currentBalance > 0.01) {
                paymentStatus = totalReceivedNpr.greaterThan(0) ? "PARTIAL" : "UNPAID";
            }
            else {
                paymentStatus = "ADVANCE_DEPOSIT";
            }
            summary.push({
                millId: m.id,
                code: m.code,
                name: m.name,
                phone: m.phone,
                location: m.location,
                openingBalance: Number(m.openingBalance),
                dispatchesCount: m.dispatches.length,
                totalDispatchedKg: totalDispatchedKg.toNumber(),
                totalAcceptedKg: totalAcceptedKg.toNumber(),
                totalTransitLossKg: totalShortageKg.toNumber(),
                totalSideCutsNpr: totalSideCutsNpr.toNumber(),
                totalBilledNpr: totalNetSettlementNpr.toNumber(),
                totalReceivedNpr: totalReceivedNpr.toNumber(),
                remainingDueNpr,
                currentReceivable: currentBalance,
                status: currentBalance >= 0 ? "RECEIVABLE" : "ADVANCE_DEPOSIT",
                paymentStatus,
            });
        }
        return summary;
    }
    /**
     * Post a controlled manual journal adjustment directly into a ledger
     */
    static async createAdjustment(input, userId) {
        const entryDate = input.date ? new Date(input.date) : new Date();
        return database_1.prisma.$transaction(async (tx) => {
            let initialBalance = new client_1.Prisma.Decimal(0);
            if (input.partyType === "FARMER") {
                const farmer = await tx.farmer.findUnique({
                    where: { id: input.partyId },
                });
                if (!farmer)
                    throw new appError_1.NotFoundError("Farmer not found");
                initialBalance = new client_1.Prisma.Decimal(farmer.openingBalance);
            }
            else {
                const mill = await tx.riceMill.findUnique({
                    where: { id: input.partyId },
                });
                if (!mill)
                    throw new appError_1.NotFoundError("Rice mill not found");
                initialBalance = new client_1.Prisma.Decimal(mill.openingBalance);
            }
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: input.partyType === "FARMER"
                    ? { farmerId: input.partyId }
                    : { millId: input.partyId },
                orderBy: { transactionDate: "desc" },
            });
            const prevBalance = lastEntry
                ? new decimal_js_1.Decimal(lastEntry.balanceAfter.toString())
                : new decimal_js_1.Decimal(initialBalance.toString());
            const adjustmentAmount = new decimal_js_1.Decimal(input.amount);
            let newBalance;
            if (input.partyType === "FARMER") {
                // For Farmer: Credit increases payable, Debit decreases payable
                newBalance =
                    input.entryType === "CREDIT"
                        ? prevBalance.plus(adjustmentAmount)
                        : prevBalance.minus(adjustmentAmount);
            }
            else {
                // For Mill: Debit increases receivable, Credit decreases receivable
                newBalance =
                    input.entryType === "DEBIT"
                        ? prevBalance.plus(adjustmentAmount)
                        : prevBalance.minus(adjustmentAmount);
            }
            const entry = await tx.ledgerEntry.create({
                data: {
                    partyType: input.partyType,
                    farmerId: input.partyType === "FARMER" ? input.partyId : null,
                    millId: input.partyType === "RICE_MILL" ? input.partyId : null,
                    transactionDate: entryDate,
                    entryType: input.entryType,
                    amount: new client_1.Prisma.Decimal(adjustmentAmount.toNumber()),
                    balanceAfter: new client_1.Prisma.Decimal(newBalance.toNumber()),
                    referenceType: "ADJUSTMENT",
                    referenceId: userId,
                    description: `Manual Adjustment: ${input.description}`,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId,
                    action: "CREATE",
                    entity: "LedgerEntry",
                    entityId: entry.id,
                    newValues: {
                        partyType: input.partyType,
                        partyId: input.partyId,
                        entryType: input.entryType,
                        amount: input.amount,
                        description: input.description,
                    },
                },
            });
            if (input.partyType === "FARMER") {
                await LedgerService.recalculateFarmerLedger(input.partyId, tx);
            }
            else {
                await LedgerService.recalculateMillLedger(input.partyId, tx);
            }
            return entry;
        });
    }
}
exports.LedgerService = LedgerService;
