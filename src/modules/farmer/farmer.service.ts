import { prisma } from '../../config/database';
import { CreateFarmerInput, UpdateFarmerInput, FarmerAdvanceInput } from './farmer.schema';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/appError';
import { Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';

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
    const existing = await this.getById(id);

    if (input.code && input.code !== existing.code) {
      const codeTaken = await prisma.farmer.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (codeTaken) {
        throw new ConflictError(`Farmer code '${input.code}' is already assigned to another farmer.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.farmer.update({
        where: { id },
        data: {
          ...(input.code ? { code: input.code } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.locality ? { locality: input.locality } : {}),
          ...(input.openingBalance !== undefined
            ? { openingBalance: new Prisma.Decimal(input.openingBalance) }
            : {}),
          ...(input.openingDate ? { openingDate: new Date(input.openingDate) } : {}),
        },
      });

      // If opening balance was changed, update the initial ledger entry if present
      if (input.openingBalance !== undefined) {
        const openingLedger = await tx.ledgerEntry.findFirst({
          where: {
            partyType: 'FARMER',
            farmerId: id,
            description: 'Opening balance migration',
          },
        });

        if (openingLedger) {
          await tx.ledgerEntry.update({
            where: { id: openingLedger.id },
            data: {
              entryType: input.openingBalance > 0 ? 'CREDIT' : 'DEBIT',
              amount: new Prisma.Decimal(Math.abs(input.openingBalance)),
              balanceAfter: new Prisma.Decimal(input.openingBalance),
            },
          });
        }

        await LedgerService.recalculateFarmerLedger(id, tx);
      }

      return updated;
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

      await LedgerService.recalculateFarmerLedger(farmerId, tx);

      return advance;
    });
  }

  static async delete(id: string) {
    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchases: true,
            advances: true,
            payments: true,
            harvesterJobs: true,
          },
        },
      },
    });

    if (!farmer) {
      throw new NotFoundError('Farmer not found');
    }

    if (
      farmer._count.purchases > 0 ||
      farmer._count.advances > 0 ||
      farmer._count.payments > 0 ||
      farmer._count.harvesterJobs > 0
    ) {
      throw new BadRequestError(
        `Cannot delete farmer '${farmer.name}' because they have existing transaction records (${farmer._count.purchases} purchase(s), ${farmer._count.advances} advance(s), ${farmer._count.payments} payment(s), ${farmer._count.harvesterJobs} harvester job(s)). Please delete the linked transactions first.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({
        where: { partyType: 'FARMER', farmerId: id },
      });
      return tx.farmer.delete({ where: { id } });
    });
  }
}
