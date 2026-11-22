import { prisma } from '../../config/database';
import { CreatePurchaseInput, UpdatePurchaseInput } from './purchase.schema';
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

  static async update(id: string, input: UpdatePurchaseInput) {
    const existing = await this.getById(id);

    return prisma.$transaction(async (tx) => {
      const grossWeight = input.grossWeightKg ?? Number(existing.grossWeightKg);
      const tareWeight = input.sackTareWeightKg ?? Number(existing.sackTareWeightKg);
      const netWeight = calculateNetWeight(grossWeight, tareWeight);
      const rate = input.rate ?? Number(existing.rate);
      const rateUnit = input.rateUnit ?? existing.rateUnit;
      const totalAmount = calculatePurchaseAmount(netWeight, rate, rateUnit);

      const updated = await tx.paddyPurchase.update({
        where: { id },
        data: {
          variety: input.variety ?? existing.variety,
          fieldLocation: input.fieldLocation ?? existing.fieldLocation,
          sackCount: input.sackCount ?? existing.sackCount,
          grossWeightKg: grossWeight,
          sackTareWeightKg: tareWeight,
          netWeightKg: netWeight.toNumber(),
          rate,
          rateUnit,
          totalAmount: totalAmount.toNumber(),
          notes: input.notes !== undefined ? input.notes : existing.notes,
          purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : existing.purchaseDate,
        },
      });

      // Update associated lot weight
      const lot = await tx.paddyLot.findFirst({ where: { purchaseId: id } });
      if (lot) {
        const diff = netWeight.toNumber() - Number(lot.initialWeightKg);
        await tx.paddyLot.update({
          where: { id: lot.id },
          data: {
            initialWeightKg: netWeight.toNumber(),
            remainingWeightKg: Math.max(0, Number(lot.remainingWeightKg) + diff),
          },
        });
      }

      // Update corresponding ledger entry
      const ledgerEntry = await tx.ledgerEntry.findFirst({
        where: { referenceType: 'PURCHASE', referenceId: id },
      });
      if (ledgerEntry) {
        await tx.ledgerEntry.update({
          where: { id: ledgerEntry.id },
          data: {
            amount: new Prisma.Decimal(totalAmount.toNumber()),
            description: `Paddy Purchase (${updated.sackCount} sacks, Net ${netWeight} kg @ NPR ${rate}/${rateUnit}) [Updated]`,
          },
        });
      }

      return updated;
    });
  }
}
