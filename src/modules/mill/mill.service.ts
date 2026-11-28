import { prisma } from '../../config/database';
import { CreateMillInput, UpdateMillInput, CreateContractInput } from './mill.schema';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/appError';
import { Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';

export class MillService {
  static async list(search?: string) {
    const where: Prisma.RiceMillWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {};

    return prisma.riceMill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { dispatches: true, settlements: true, contracts: true },
        },
      },
    });
  }

  static async getById(id: string) {
    const mill = await prisma.riceMill.findUnique({
      where: { id },
      include: {
        contracts: {
          orderBy: { createdAt: 'desc' },
        },
        dispatches: {
          take: 5,
          orderBy: { dispatchDate: 'desc' },
        },
        settlements: {
          take: 5,
          orderBy: { receiptDate: 'desc' },
        },
      },
    });

    if (!mill) {
      throw new NotFoundError('Rice mill not found');
    }

    return mill;
  }

  static async create(input: CreateMillInput) {
    const existing = await prisma.riceMill.findUnique({
      where: { code: input.code },
    });

    if (existing) {
      throw new ConflictError(`Rice Mill with code '${input.code}' already exists`);
    }

    return prisma.$transaction(async (tx) => {
      const mill = await tx.riceMill.create({
        data: {
          code: input.code,
          name: input.name,
          contactPerson: input.contactPerson,
          phone: input.phone,
          location: input.location,
          openingBalance: input.openingBalance,
        },
      });

      if (input.openingBalance !== 0) {
        await tx.ledgerEntry.create({
          data: {
            partyType: 'RICE_MILL',
            millId: mill.id,
            transactionDate: new Date(),
            entryType: input.openingBalance > 0 ? 'DEBIT' : 'CREDIT',
            amount: new Prisma.Decimal(Math.abs(input.openingBalance)),
            balanceAfter: new Prisma.Decimal(input.openingBalance),
            referenceType: 'ADJUSTMENT',
            referenceId: mill.id,
            description: 'Opening balance migration',
          },
        });
      }

      return mill;
    });
  }

  static async update(id: string, input: UpdateMillInput) {
    const existing = await this.getById(id);

    if (input.code && input.code !== existing.code) {
      const codeTaken = await prisma.riceMill.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (codeTaken) {
        throw new ConflictError(`Rice Mill code '${input.code}' is already assigned to another mill.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.riceMill.update({
        where: { id },
        data: {
          ...(input.code ? { code: input.code } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.location ? { location: input.location } : {}),
          ...(input.openingBalance !== undefined
            ? { openingBalance: new Prisma.Decimal(input.openingBalance) }
            : {}),
        },
      });

      if (input.openingBalance !== undefined) {
        const openingLedger = await tx.ledgerEntry.findFirst({
          where: {
            partyType: 'RICE_MILL',
            millId: id,
            description: 'Opening balance migration',
          },
        });

        if (openingLedger) {
          await tx.ledgerEntry.update({
            where: { id: openingLedger.id },
            data: {
              entryType: input.openingBalance > 0 ? 'DEBIT' : 'CREDIT',
              amount: new Prisma.Decimal(Math.abs(input.openingBalance)),
              balanceAfter: new Prisma.Decimal(input.openingBalance),
            },
          });
        }

        await LedgerService.recalculateMillLedger(id, tx);
      }

      return updated;
    });
  }

  static async createContract(millId: string, input: CreateContractInput) {
    await this.getById(millId);

    const existing = await prisma.millContract.findUnique({
      where: { contractNumber: input.contractNumber },
    });

    if (existing) {
      throw new ConflictError(`Contract '${input.contractNumber}' already exists`);
    }

    return prisma.millContract.create({
      data: {
        millId,
        contractNumber: input.contractNumber,
        variety: input.variety,
        targetWeightKg: input.targetWeightKg,
        ratePerKg: input.ratePerKg,
        maxMoisture: input.maxMoisture,
      },
    });
  }

  static async getLedger(millId: string, fromDate?: string, toDate?: string) {
    await this.getById(millId);

    const where: Prisma.LedgerEntryWhereInput = {
      partyType: 'RICE_MILL',
      millId,
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

    const latestEntry = await prisma.ledgerEntry.findFirst({
      where: { partyType: 'RICE_MILL', millId },
      orderBy: { transactionDate: 'desc' },
    });

    return {
      millId,
      currentReceivable: latestEntry ? latestEntry.balanceAfter : 0,
      entries,
    };
  }

  static async delete(id: string) {
    const mill = await prisma.riceMill.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            dispatches: true,
            settlements: true,
            payments: true,
            contracts: true,
          },
        },
      },
    });

    if (!mill) {
      throw new NotFoundError('Rice mill not found');
    }

    if (
      mill._count.dispatches > 0 ||
      mill._count.settlements > 0 ||
      mill._count.payments > 0
    ) {
      throw new BadRequestError(
        `Cannot delete rice mill '${mill.name}' because it has active records (${mill._count.dispatches} dispatch(es), ${mill._count.settlements} settlement(s), ${mill._count.payments} payment(s)). Please delete or adjust the dispatches first.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.millContract.deleteMany({ where: { millId: id } });
      await tx.ledgerEntry.deleteMany({
        where: { partyType: 'RICE_MILL', millId: id },
      });
      return tx.riceMill.delete({ where: { id } });
    });
  }
}
