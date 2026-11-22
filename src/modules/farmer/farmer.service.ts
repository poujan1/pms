import { prisma } from '../../config/database';
import { CreateFarmerInput, UpdateFarmerInput, FarmerAdvanceInput } from './farmer.schema';
import { NotFoundError, ConflictError } from '../../utils/appError';
import { Prisma } from '@prisma/client';

export class FarmerService {
  static async list(search?: string) {
    const where: Prisma.FarmerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { locality: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const farmers = await prisma.farmer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { purchases: true, harvesterJobs: true },
        },
      },
    });

    return farmers;
  }

  static async getById(id: string) {
    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          take: 5,
        },
        advances: {
          orderBy: { date: 'desc' },
          take: 5,
        },
        harvesterJobs: {
          orderBy: { workDate: 'desc' },
          take: 5,
        },
      },
    });

    if (!farmer) {
      throw new NotFoundError('Farmer not found');
    }

    return farmer;
  }

  static async create(input: CreateFarmerInput) {
    const existing = await prisma.farmer.findUnique({
      where: { code: input.code },
    });

    if (existing) {
      throw new ConflictError(`Farmer with code '${input.code}' already exists`);
    }

    return prisma.$transaction(async (tx) => {
      const farmer = await tx.farmer.create({
        data: {
          code: input.code,
          name: input.name,
          phone: input.phone,
          locality: input.locality,
          openingBalance: input.openingBalance,
          openingDate: input.openingDate ? new Date(input.openingDate) : new Date(),
        },
      });

      // If there is an opening balance, initialize the ledger entry
      if (input.openingBalance !== 0) {
        await tx.ledgerEntry.create({
          data: {
            partyType: 'FARMER',
            farmerId: farmer.id,
            transactionDate: farmer.openingDate || new Date(),
            entryType: input.openingBalance > 0 ? 'CREDIT' : 'DEBIT',
            amount: new Prisma.Decimal(Math.abs(input.openingBalance)),
            balanceAfter: new Prisma.Decimal(input.openingBalance),
            referenceType: 'ADJUSTMENT',
            referenceId: farmer.id,
            description: 'Opening balance migration',
          },
        });
      }

      return farmer;
    });
  }

  static async update(id: string, input: UpdateFarmerInput) {
    await this.getById(id);
    return prisma.farmer.update({
      where: { id },
      data: input,
    });
  }

  static async getLedger(farmerId: string, fromDate?: string, toDate?: string) {
    await this.getById(farmerId);

    const where: Prisma.LedgerEntryWhereInput = {
      partyType: 'FARMER',
      farmerId,
      ...(fromDate || toDate
        ? {
            transactionDate: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const entries = await prisma.ledgerEntry.findMany({
      where,
      orderBy: { transactionDate: 'asc' },
    });

    // Calculate current running balance
    const latestEntry = await prisma.ledgerEntry.findFirst({
      where: { partyType: 'FARMER', farmerId },
      orderBy: { transactionDate: 'desc' },
    });

    return {
      farmerId,
      currentBalance: latestEntry ? latestEntry.balanceAfter : 0,
      entries,
    };
  }

  static async recordAdvance(farmerId: string, input: FarmerAdvanceInput, userId: string) {
    const farmer = await this.getById(farmerId);
    const advanceDate = input.date ? new Date(input.date) : new Date();

    return prisma.$transaction(async (tx) => {
      // 1. Record Advance
      const advance = await tx.farmerAdvance.create({
        data: {
          farmerId,
          amount: input.amount,
          notes: input.notes,
          date: advanceDate,
        },
      });

      // 2. Fetch latest balance
      const latestEntry = await tx.ledgerEntry.findFirst({
        where: { partyType: 'FARMER', farmerId },
        orderBy: { transactionDate: 'desc' },
      });

      const currentBalance = latestEntry
        ? new Prisma.Decimal(latestEntry.balanceAfter)
        : new Prisma.Decimal(farmer.openingBalance);

      // Paying advance reduces liability (DEBIT)
      const newBalance = currentBalance.minus(input.amount);

      await tx.ledgerEntry.create({
        data: {
          partyType: 'FARMER',
          farmerId,
          transactionDate: advanceDate,
          entryType: 'DEBIT',
          amount: new Prisma.Decimal(input.amount),
          balanceAfter: newBalance,
          referenceType: 'PAYMENT',
          referenceId: advance.id,
          description: `Pre-harvest advance / cash payment: ${input.notes || ''}`.trim(),
        },
      });

      return advance;
    });
  }
}
