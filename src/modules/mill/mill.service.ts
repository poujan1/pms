import { prisma } from '../../config/database';
import { CreateMillInput, UpdateMillInput, CreateContractInput } from './mill.schema';
import { NotFoundError, ConflictError } from '../../utils/appError';
import { Prisma } from '@prisma/client';

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
    await this.getById(id);
    return prisma.riceMill.update({
      where: { id },
      data: input,
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
}
