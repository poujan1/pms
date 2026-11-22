import { prisma } from '../../config/database';
import { CreateSettlementInput } from './settlement.schema';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/appError';
import { Prisma, DeductionType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class SettlementService {
  static async list(params?: { millId?: string; fromDate?: string; toDate?: string }) {
    const where: Prisma.MillSettlementWhereInput = {
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

    return prisma.millSettlement.findMany({
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

  static async getById(id: string) {
    const settlement = await prisma.millSettlement.findUnique({
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
      throw new NotFoundError('Mill settlement record not found');
    }

    return settlement;
  }

  static async create(input: CreateSettlementInput, userId: string) {
    const dispatch = await prisma.truckDispatch.findUnique({
      where: { id: input.dispatchId },
      include: { mill: true },
    });

    if (!dispatch) {
      throw new NotFoundError('Truck dispatch not found');
    }

    const existing = await prisma.millSettlement.findUnique({
      where: { dispatchId: input.dispatchId },
    });

    if (existing) {
      throw new ConflictError('A settlement has already been recorded for this dispatch');
    }

    const receiptDate = input.receiptDate ? new Date(input.receiptDate) : new Date();

    // Dispatched net weight vs Mill received weight
    const dispatchedNetKg = new Decimal(dispatch.netWeightKg.toString());
    const receivedKg = new Decimal(input.receivedWeightKg);
    const shortageWeightKg = dispatchedNetKg.minus(receivedKg); // Positive means transit loss

    // Calculate deductions
    let finalAcceptedKg = new Decimal(receivedKg);
    let totalDeductionsNpr = new Decimal(0);

    const calculatedDeductions: {
      name: string;
      type: DeductionType;
      rateOrValue: number;
      impactInKg: number | null;
      impactInNpr: number;
    }[] = [];

    // Step A: First process weight-based deductions
    for (const d of input.deductions) {
      const val = new Decimal(d.rateOrValue);

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
      } else if (d.type === 'SACK_TARE_CUT') {
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
      } else if (d.type === 'PERCENTAGE_CUT') {
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
      throw new BadRequestError('Deductions exceed the total received weight');
    }

    // Step B: Calculate gross settlement on final accepted weight
    const grossSettlementNpr = input.millRateUnit === 'QUINTAL'
      ? finalAcceptedKg.dividedBy(100).times(input.millRate).toDecimalPlaces(2)
      : finalAcceptedKg.times(input.millRate).toDecimalPlaces(2);

    let netPayableByMill = new Decimal(grossSettlementNpr);

    // Step C: Process monetary-based deductions
    for (const d of input.deductions) {
      const val = new Decimal(d.rateOrValue);

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
      } else if (d.type === 'FIXED_MONEY_CUT') {
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
    return prisma.$transaction(async (tx) => {
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
        ? new Prisma.Decimal(lastEntry.balanceAfter)
        : new Prisma.Decimal(dispatch.mill.openingBalance);

      const newBalance = prevBalance.plus(netPayableByMill.toNumber());

      await tx.ledgerEntry.create({
        data: {
          partyType: 'RICE_MILL',
          millId: dispatch.millId,
          transactionDate: receiptDate,
          entryType: 'DEBIT',
          amount: new Prisma.Decimal(netPayableByMill.toNumber()),
          balanceAfter: newBalance,
          referenceType: 'SETTLEMENT',
          referenceId: settlement.id,
          description: `Dispatch ${dispatch.dispatchNumber} settlement (${finalAcceptedKg.toFixed(2)} kg accepted @ NPR ${input.millRate}/${input.millRateUnit})`,
        },
      });

      return settlement;
    });
  }
}
