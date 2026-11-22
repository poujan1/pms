import { prisma } from '../../config/database';
import { CreatePurchaseInput } from './purchase.schema';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/appError';
import { calculateNetWeight, calculatePurchaseAmount } from '../../utils/numberUtils';
import { Prisma } from '@prisma/client';

export class PurchaseService {
  static async list(params?: { farmerId?: string; fromDate?: string; toDate?: string; search?: string }) {
    const where: Prisma.PaddyPurchaseWhereInput = {
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

    return prisma.paddyPurchase.findMany({
      where,
      orderBy: { purchaseDate: 'desc' },
      include: {
        farmer: { select: { id: true, name: true, code: true, phone: true } },
        lot: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async getById(id: string) {
    const purchase = await prisma.paddyPurchase.findUnique({
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
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!purchase) {
      throw new NotFoundError('Purchase record not found');
    }

    return purchase;
  }

  static async create(input: CreatePurchaseInput, userId: string) {
    const farmer = await prisma.farmer.findUnique({ where: { id: input.farmerId } });
    if (!farmer) throw new NotFoundError('Farmer not found');

    const existing = await prisma.paddyPurchase.findUnique({
      where: { purchaseNumber: input.purchaseNumber },
    });
    if (existing) {
      throw new ConflictError(`Purchase number '${input.purchaseNumber}' is already in use`);
    }

    const netWeight = calculateNetWeight(input.grossWeightKg, input.sackTareWeightKg);
    if (netWeight.isZero()) {
      throw new BadRequestError('Net weight cannot be zero');
    }

    const totalAmount = calculatePurchaseAmount(netWeight, input.rate, input.rateUnit);
    const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : new Date();

    return prisma.$transaction(async (tx) => {
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
        ? new Prisma.Decimal(lastEntry.balanceAfter)
        : new Prisma.Decimal(farmer.openingBalance);

      const newBalance = prevBalance.plus(totalAmount.toNumber());

      await tx.ledgerEntry.create({
        data: {
          partyType: 'FARMER',
          farmerId: input.farmerId,
          transactionDate: purchaseDate,
          entryType: 'CREDIT',
          amount: new Prisma.Decimal(totalAmount.toNumber()),
          balanceAfter: newBalance,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          description: `Paddy Purchase (${input.sackCount} sacks, Net ${netWeight} kg @ NPR ${input.rate}/${input.rateUnit})`,
        },
      });

      return { ...purchase, lot };
    });
  }
}
