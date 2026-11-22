"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HarvesterService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
const ledger_service_1 = require("../ledger/ledger.service");
class HarvesterService {
    static async listMachines() {
        return database_1.prisma.harvesterMachine.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { workLogs: true } },
            },
        });
    }
    static async createMachine(input) {
        return database_1.prisma.harvesterMachine.create({
            data: input,
        });
    }
    static async listWorkLogs(farmerId, machineId) {
        const where = {
            ...(farmerId ? { farmerId } : {}),
            ...(machineId ? { machineId } : {}),
        };
        return database_1.prisma.harvesterWork.findMany({
            where,
            orderBy: { workDate: 'desc' },
            include: {
                farmer: { select: { id: true, name: true, code: true } },
                machine: { select: { id: true, name: true, operatorName: true } },
                purchase: { select: { id: true, purchaseNumber: true, totalAmount: true } },
            },
        });
    }
    static async logWork(input, userId) {
        const farmer = await database_1.prisma.farmer.findUnique({ where: { id: input.farmerId } });
        if (!farmer)
            throw new appError_1.NotFoundError('Farmer not found');
        const machine = await database_1.prisma.harvesterMachine.findUnique({ where: { id: input.machineId } });
        if (!machine)
            throw new appError_1.NotFoundError('Harvester Machine not found');
        const workDate = input.workDate ? new Date(input.workDate) : new Date();
        // Time-based calculation: (durationMinutes / 60) * hourlyRate
        let durationMinutes = input.durationMinutes ?? null;
        let hourlyRate = input.hourlyRate ?? null;
        let workQuantity = input.workQuantity ?? null;
        let ratePerUnit = input.ratePerUnit ?? null;
        let totalCharge;
        if (durationMinutes && durationMinutes > 0 && hourlyRate && hourlyRate > 0) {
            const hours = new decimal_js_1.Decimal(durationMinutes).dividedBy(60);
            totalCharge = hours.times(new decimal_js_1.Decimal(hourlyRate)).toDecimalPlaces(2);
            workQuantity = hours.toDecimalPlaces(2).toNumber();
            ratePerUnit = hourlyRate;
        }
        else if (workQuantity && workQuantity > 0 && ratePerUnit && ratePerUnit > 0) {
            totalCharge = new decimal_js_1.Decimal(workQuantity).times(new decimal_js_1.Decimal(ratePerUnit)).toDecimalPlaces(2);
            durationMinutes = Math.round(workQuantity * 60);
            hourlyRate = ratePerUnit;
        }
        else {
            throw new Error('Either duration in minutes and hourly rate, or work quantity and rate must be provided');
        }
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Record the Harvester Work Log
            const workLog = await tx.harvesterWork.create({
                data: {
                    workDate,
                    farmerId: input.farmerId,
                    machineId: input.machineId,
                    purchaseId: input.purchaseId ?? null,
                    landArea: input.landArea ?? null,
                    durationMinutes,
                    hourlyRate,
                    workQuantity,
                    ratePerUnit,
                    totalCharge: totalCharge.toNumber(),
                    chargeHandling: input.chargeHandling,
                    notes: input.notes ?? null,
                },
                include: {
                    farmer: { select: { id: true, name: true, code: true } },
                    machine: { select: { id: true, name: true, operatorName: true } },
                    purchase: { select: { id: true, purchaseNumber: true } },
                },
            });
            // 2. Handle Accounting Posting
            if (input.chargeHandling === 'FARMER_DEDUCTION') {
                // Deduct from farmer's payable (DEBIT farmer ledger)
                const lastEntry = await tx.ledgerEntry.findFirst({
                    where: { partyType: 'FARMER', farmerId: input.farmerId },
                    orderBy: { transactionDate: 'desc' },
                });
                const prevBalance = lastEntry
                    ? new client_1.Prisma.Decimal(lastEntry.balanceAfter)
                    : new client_1.Prisma.Decimal(farmer.openingBalance);
                const newBalance = prevBalance.minus(totalCharge.toNumber());
                const timeDesc = durationMinutes ? `${durationMinutes} mins` : `${workQuantity} hrs`;
                const landDesc = input.landArea ? ` [${input.landArea}]` : '';
                await tx.ledgerEntry.create({
                    data: {
                        partyType: 'FARMER',
                        farmerId: input.farmerId,
                        transactionDate: workDate,
                        entryType: 'DEBIT',
                        amount: new client_1.Prisma.Decimal(totalCharge.toNumber()),
                        balanceAfter: newBalance,
                        referenceType: 'HARVESTER',
                        referenceId: workLog.id,
                        description: `Harvester charge deducted (${timeDesc}${landDesc} @ NPR ${hourlyRate ?? ratePerUnit}/hr - ${machine.name})`,
                    },
                });
                await ledger_service_1.LedgerService.recalculateFarmerLedger(input.farmerId, tx);
            }
            else {
                // Company Expense: Cost from our pocket, audited on main expense ledger
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
                const timeDesc = durationMinutes ? `${durationMinutes} mins` : `${workQuantity} hrs`;
                const landDesc = input.landArea ? ` [${input.landArea}]` : '';
                await tx.businessExpense.create({
                    data: {
                        categoryId: category.id,
                        expenseDate: workDate,
                        amount: new client_1.Prisma.Decimal(totalCharge.toNumber()),
                        paidTo: machine.operatorName,
                        notes: `Harvester machine cost (${timeDesc}${landDesc} - ${machine.name}) for farmer ${farmer.name}`,
                        createdById: userId,
                    },
                });
            }
            return workLog;
        });
    }
    static async getSummary() {
        const logs = await database_1.prisma.harvesterWork.findMany({
            select: {
                totalCharge: true,
                chargeHandling: true,
                durationMinutes: true,
            },
        });
        const machinesCount = await database_1.prisma.harvesterMachine.count();
        let totalBilledNpr = 0;
        let totalFarmerDeductionsNpr = 0;
        let totalCompanyExpenseNpr = 0;
        let totalMinutesWorked = 0;
        for (const log of logs) {
            const charge = Number(log.totalCharge);
            totalBilledNpr += charge;
            if (log.chargeHandling === 'FARMER_DEDUCTION') {
                totalFarmerDeductionsNpr += charge;
            }
            else {
                totalCompanyExpenseNpr += charge;
            }
            if (log.durationMinutes) {
                totalMinutesWorked += log.durationMinutes;
            }
        }
        return {
            totalBilledNpr,
            totalFarmerDeductionsNpr,
            totalCompanyExpenseNpr,
            totalMinutesWorked,
            totalHoursWorked: Math.round((totalMinutesWorked / 60) * 100) / 100,
            totalJobsCount: logs.length,
            totalMachinesCount: machinesCount,
        };
    }
}
exports.HarvesterService = HarvesterService;
