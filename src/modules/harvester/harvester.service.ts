import { prisma } from '../../config/database';
import { CreateMachineInput, LogHarvesterWorkInput } from './harvester.schema';
import { NotFoundError } from '../../utils/appError';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { LedgerService } from '../ledger/ledger.service';

export class HarvesterService {
  static async listMachines() {
    return prisma.harvesterMachine.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { workLogs: true } },
      },
    });
  }

  static async createMachine(input: CreateMachineInput) {
    return prisma.harvesterMachine.create({
      data: input,
    });
  }

  static async listWorkLogs(farmerId?: string, machineId?: string) {
    const where: Prisma.HarvesterWorkWhereInput = {
      ...(farmerId ? { farmerId } : {}),
      ...(machineId ? { machineId } : {}),
    };

    return prisma.harvesterWork.findMany({
      where,
      orderBy: { workDate: 'desc' },
      include: {
        farmer: { select: { id: true, name: true, code: true } },
        machine: { select: { id: true, name: true, operatorName: true } },
        purchase: { select: { id: true, purchaseNumber: true, totalAmount: true } },
      },
    });
  }

  static async logWork(input: LogHarvesterWorkInput, userId: string) {
    const farmer = await prisma.farmer.findUnique({ where: { id: input.farmerId } });
    if (!farmer) throw new NotFoundError('Farmer not found');

    const machine = await prisma.harvesterMachine.findUnique({ where: { id: input.machineId } });
    if (!machine) throw new NotFoundError('Harvester Machine not found');

    const workDate = input.workDate ? new Date(input.workDate) : new Date();

    // Time-based calculation: (durationMinutes / 60) * hourlyRate
    let durationMinutes = input.durationMinutes ?? null;
    let hourlyRate = input.hourlyRate ?? null;
    let workQuantity = input.workQuantity ?? null;
    let ratePerUnit = input.ratePerUnit ?? null;
    let totalCharge: Decimal;

    if (durationMinutes && durationMinutes > 0 && hourlyRate && hourlyRate > 0) {
      const hours = new Decimal(durationMinutes).dividedBy(60);
      totalCharge = hours.times(new Decimal(hourlyRate)).toDecimalPlaces(2);
      workQuantity = hours.toDecimalPlaces(2).toNumber();
      ratePerUnit = hourlyRate;
    } else if (workQuantity && workQuantity > 0 && ratePerUnit && ratePerUnit > 0) {
      totalCharge = new Decimal(workQuantity).times(new Decimal(ratePerUnit)).toDecimalPlaces(2);
      durationMinutes = Math.round(workQuantity * 60);
      hourlyRate = ratePerUnit;
    } else {
      throw new Error('Either duration in minutes and hourly rate, or work quantity and rate must be provided');
    }

    return prisma.$transaction(async (tx) => {
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
          ? new Prisma.Decimal(lastEntry.balanceAfter)
          : new Prisma.Decimal(farmer.openingBalance);

        const newBalance = prevBalance.minus(totalCharge.toNumber());
        const timeDesc = durationMinutes ? `${durationMinutes} mins` : `${workQuantity} hrs`;
        const landDesc = input.landArea ? ` [${input.landArea}]` : '';

        await tx.ledgerEntry.create({
          data: {
            partyType: 'FARMER',
            farmerId: input.farmerId,
            transactionDate: workDate,
            entryType: 'DEBIT',
            amount: new Prisma.Decimal(totalCharge.toNumber()),
            balanceAfter: newBalance,
            referenceType: 'HARVESTER',
            referenceId: workLog.id,
            description: `Harvester charge deducted (${timeDesc}${landDesc} @ NPR ${hourlyRate ?? ratePerUnit}/hr - ${machine.name})`,
          },
        });

        await LedgerService.recalculateFarmerLedger(input.farmerId, tx);
      } else {
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
            amount: new Prisma.Decimal(totalCharge.toNumber()),
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
    const logs = await prisma.harvesterWork.findMany({
      select: {
        totalCharge: true,
        chargeHandling: true,
        durationMinutes: true,
      },
    });

    const machinesCount = await prisma.harvesterMachine.count();

    let totalBilledNpr = 0;
    let totalFarmerDeductionsNpr = 0;
    let totalCompanyExpenseNpr = 0;
    let totalMinutesWorked = 0;

    for (const log of logs) {
      const charge = Number(log.totalCharge);
      totalBilledNpr += charge;
      if (log.chargeHandling === 'FARMER_DEDUCTION') {
        totalFarmerDeductionsNpr += charge;
      } else {
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
