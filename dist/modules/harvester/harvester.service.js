"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HarvesterService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
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
        const totalCharge = new decimal_js_1.Decimal(input.workQuantity).times(new decimal_js_1.Decimal(input.ratePerUnit)).toDecimalPlaces(2);
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Record the Harvester Work Log
            const workLog = await tx.harvesterWork.create({
                data: {
                    workDate,
                    farmerId: input.farmerId,
                    machineId: input.machineId,
                    workQuantity: input.workQuantity,
                    ratePerUnit: input.ratePerUnit,
                    totalCharge: totalCharge.toNumber(),
                    chargeHandling: input.chargeHandling,
                    notes: input.notes,
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
                        description: `Harvester charge deducted (${input.workQuantity} units @ NPR ${input.ratePerUnit} - ${machine.name})`,
                    },
                });
            }
            else {
                // Business expense: Ensure there's a category and log expense
                let category = await tx.expenseCategory.findUnique({
                    where: { name: 'Harvesting Machinery' },
                });
                if (!category) {
                    category = await tx.expenseCategory.create({
                        data: { name: 'Harvesting Machinery' },
                    });
                }
                await tx.businessExpense.create({
                    data: {
                        categoryId: category.id,
                        expenseDate: workDate,
                        amount: new client_1.Prisma.Decimal(totalCharge.toNumber()),
                        paidTo: `${machine.operatorName} (${machine.name})`,
                        notes: `Field harvest for farmer: ${farmer.name} (${farmer.code})`,
                        createdById: userId,
                    },
                });
            }
            return workLog;
        });
    }
}
exports.HarvesterService = HarvesterService;
