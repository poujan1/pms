import { prisma } from '../../config/database';
import { CreateMachineInput, LogHarvesterWorkInput } from './harvester.schema';
import { NotFoundError } from '../../utils/appError';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

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
      },
    });
  }

  static async logWork(input: LogHarvesterWorkInput, userId: string) {
    const farmer = await prisma.farmer.findUnique({ where: { id: input.farmerId } });
    if (!farmer) throw new NotFoundError('Farmer not found');

    const machine = await prisma.harvesterMachine.findUnique({ where: { id: input.machineId } });
    if (!machine) throw new NotFoundError('Harvester Machine not found');

    const workDate = input.workDate ? new Date(input.workDate) : new Date();
    const totalCharge = new Decimal(input.workQuantity).times(new Decimal(input.ratePerUnit)).toDecimalPlaces(2);

    return prisma.$transaction(async (tx) => {
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
          ? new Prisma.Decimal(lastEntry.balanceAfter)
          : new Prisma.Decimal(farmer.openingBalance);

        const newBalance = prevBalance.minus(totalCharge.toNumber());

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
            description: `Harvester charge deducted (${input.workQuantity} units @ NPR ${input.ratePerUnit} - ${machine.name})`,
          },
        });
      } else {
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
            amount: new Prisma.Decimal(totalCharge.toNumber()),
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
