import { prisma } from '../../config/database';
import { CreatePaymentInput, UpdatePaymentInput } from './payment.schema';
import { NotFoundError, ConflictError } from '../../utils/appError';
import { Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';

export class PaymentService {
  static async list(params?: { partyType?: 'FARMER' | 'RICE_MILL'; partyId?: string; fromDate?: string; toDate?: string }) {
    const where: Prisma.PaymentTransactionWhereInput = {
      ...(params?.partyType ? { partyType: params.partyType } : {}),
      ...(params?.partyId
        ? params.partyType === 'FARMER'
          ? { farmerId: params.partyId }
          : { millId: params.partyId }
        : {}),
      ...(params?.fromDate || params?.toDate
        ? {
            paymentDate: {
              ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
              ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
            },
          }
        : {}),
    };

    return prisma.paymentTransaction.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async getById(id: string) {
    const payment = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment transaction not found');
    }

    return payment;
  }

  static async create(input: CreatePaymentInput, userId: string) {
    const existing = await prisma.paymentTransaction.findUnique({
      where: { voucherNumber: input.voucherNumber },
    });

    if (existing) {
      throw new ConflictError(`Voucher number '${input.voucherNumber}' already exists`);
    }

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

    return prisma.$transaction(async (tx) => {
      let initialBalance = new Prisma.Decimal(0);

      if (input.partyType === 'FARMER') {
        const farmer = await tx.farmer.findUnique({ where: { id: input.partyId } });
        if (!farmer) throw new NotFoundError('Farmer not found');
        initialBalance = new Prisma.Decimal(farmer.openingBalance);
      } else {
        const mill = await tx.riceMill.findUnique({ where: { id: input.partyId } });
        if (!mill) throw new NotFoundError('Rice mill not found');
        initialBalance = new Prisma.Decimal(mill.openingBalance);
      }

      // 2. Create Payment Transaction
      const payment = await tx.paymentTransaction.create({
        data: {
          voucherNumber: input.voucherNumber,
          paymentDate,
          partyType: input.partyType,
          farmerId: input.partyType === 'FARMER' ? input.partyId : null,
          millId: input.partyType === 'RICE_MILL' ? input.partyId : null,
          amount: new Prisma.Decimal(input.amount),
          paymentMode: input.paymentMode,
          referenceNumber: input.referenceNumber || null,
          notes: input.notes || null,
          createdById: userId,
        },
      });

      // 3. Post to the relevant ledger
      const lastEntry = await tx.ledgerEntry.findFirst({
        where: input.partyType === 'FARMER'
          ? { partyType: 'FARMER', farmerId: input.partyId }
          : { partyType: 'RICE_MILL', millId: input.partyId },
        orderBy: { transactionDate: 'desc' },
      });

      const prevBalance = lastEntry ? new Prisma.Decimal(lastEntry.balanceAfter) : initialBalance;

      // When paying Farmer: DEBIT reduces what we owe farmer (Liability - Amount)
      // When receiving from Mill: CREDIT reduces what mill owes us (Asset - Amount)
      const entryType = input.partyType === 'FARMER' ? 'DEBIT' : 'CREDIT';
      const newBalance = prevBalance.minus(input.amount);

      await tx.ledgerEntry.create({
        data: {
          partyType: input.partyType,
          farmerId: input.partyType === 'FARMER' ? input.partyId : null,
          millId: input.partyType === 'RICE_MILL' ? input.partyId : null,
          transactionDate: paymentDate,
          entryType,
          amount: new Prisma.Decimal(input.amount),
          balanceAfter: newBalance,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          description: `${input.partyType === 'FARMER' ? 'Payment to Farmer' : 'Receipt from Rice Mill'} via ${input.paymentMode}${input.referenceNumber ? ` (Ref: ${input.referenceNumber})` : ''}`,
        },
      });

      if (input.partyType === 'FARMER') {
        await LedgerService.recalculateFarmerLedger(input.partyId, tx);
      } else {
        await LedgerService.recalculateMillLedger(input.partyId, tx);
      }

      return payment;
    });
  }

  static async update(id: string, input: UpdatePaymentInput) {
    const existing = await this.getById(id);

    return prisma.$transaction(async (tx) => {
      const paymentDate = input.paymentDate ? new Date(input.paymentDate) : existing.paymentDate;
      const amount = input.amount !== undefined ? new Prisma.Decimal(input.amount) : existing.amount;
      const paymentMode = input.paymentMode ?? existing.paymentMode;
      const referenceNumber = input.referenceNumber !== undefined ? input.referenceNumber : existing.referenceNumber;
      const notes = input.notes !== undefined ? input.notes : existing.notes;

      const updated = await tx.paymentTransaction.update({
        where: { id },
        data: {
          paymentDate,
          amount,
          paymentMode,
          referenceNumber,
          notes,
        },
      });

      const ledgerEntry = await tx.ledgerEntry.findFirst({
        where: { referenceType: 'PAYMENT', referenceId: id },
      });

      if (ledgerEntry) {
        await tx.ledgerEntry.update({
          where: { id: ledgerEntry.id },
          data: {
            transactionDate: paymentDate,
            amount,
            description: `${existing.partyType === 'FARMER' ? 'Payment to Farmer' : 'Receipt from Rice Mill'} via ${paymentMode}${referenceNumber ? ` (Ref: ${referenceNumber})` : ''} [Updated]`,
          },
        });
      }

      if (existing.partyType === 'FARMER' && existing.farmerId) {
        await LedgerService.recalculateFarmerLedger(existing.farmerId, tx);
      } else if (existing.partyType === 'RICE_MILL' && existing.millId) {
        await LedgerService.recalculateMillLedger(existing.millId, tx);
      }

      return updated;
    });
  }

  static async delete(id: string) {
    const existing = await this.getById(id);

    return prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({
        where: { referenceType: 'PAYMENT', referenceId: id },
      });

      const deleted = await tx.paymentTransaction.delete({ where: { id } });

      if (existing.partyType === 'FARMER' && existing.farmerId) {
        await LedgerService.recalculateFarmerLedger(existing.farmerId, tx);
      } else if (existing.partyType === 'RICE_MILL' && existing.millId) {
        await LedgerService.recalculateMillLedger(existing.millId, tx);
      }

      return deleted;
    });
  }
}
