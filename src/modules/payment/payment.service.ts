import { prisma } from '../../config/database';
import { CreatePaymentInput } from './payment.schema';
import { NotFoundError, ConflictError } from '../../utils/appError';
import { Prisma } from '@prisma/client';

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
          amount: input.amount,
          paymentMode: input.paymentMode,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          createdById: userId,
        },
      });

      // 3. Post to the relevant ledger
      const lastEntry = await tx.ledgerEntry.findFirst({
        where: input.partyType === 'FARMER' ? { farmerId: input.partyId } : { millId: input.partyId },
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

      return payment;
    });
  }
}
