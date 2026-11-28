import { prisma } from '../../config/database';
import { CreateDispatchInput, UpdateDispatchInput } from './dispatch.schema';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/appError';
import { calculateNetWeight } from '../../utils/numberUtils';
import { Prisma, DispatchStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class DispatchService {
  static async list(params?: { millId?: string; status?: DispatchStatus; fromDate?: string; toDate?: string }) {
    const where: Prisma.TruckDispatchWhereInput = {
      ...(params?.millId ? { millId: params.millId } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.fromDate || params?.toDate
        ? {
            dispatchDate: {
              ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
              ...(params?.toDate ? { lte: new Date(params.toDate) } : {}),
            },
          }
        : {}),
    };

    return prisma.truckDispatch.findMany({
      where,
      orderBy: { dispatchDate: 'desc' },
      include: {
        mill: { select: { id: true, name: true, code: true } },
        contract: true,
        allocations: {
          include: {
            lot: {
              include: {
                purchase: {
                  include: {
                    farmer: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
          },
        },
        settlement: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  static async getById(id: string) {
    const dispatch = await prisma.truckDispatch.findUnique({
      where: { id },
      include: {
        mill: true,
        contract: true,
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
        settlement: {
          include: {
            deductions: true,
          },
        },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!dispatch) {
      throw new NotFoundError('Truck dispatch record not found');
    }

    return dispatch;
  }

  static async getAvailableLots() {
    return prisma.paddyLot.findMany({
      where: {
        isExhausted: false,
        remainingWeightKg: { gt: 0 },
      },
      include: {
        purchase: {
          include: {
            farmer: { select: { id: true, name: true, code: true, locality: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async create(input: CreateDispatchInput, userId: string) {
    const mill = await prisma.riceMill.findUnique({ where: { id: input.millId } });
    if (!mill) throw new NotFoundError('Rice mill not found');

    const existing = await prisma.truckDispatch.findUnique({
      where: { dispatchNumber: input.dispatchNumber },
    });
    if (existing) {
      throw new ConflictError(`Dispatch number '${input.dispatchNumber}' is already in use`);
    }

    const netWeight = calculateNetWeight(input.grossWeightKg, input.tareWeightKg);

    // Sum of allocated kg must match or be reasonable vs net weight
    let totalAllocatedKg = new Decimal(0);
    for (const alloc of input.allocations) {
      totalAllocatedKg = totalAllocatedKg.plus(alloc.allocatedKg);
    }

    // Execute in transaction: validate each lot's available balance and deduct
    return prisma.$transaction(async (tx) => {
      // 1. Validate & Reserve Lots
      for (const alloc of input.allocations) {
        const lot = await tx.paddyLot.findUnique({
          where: { id: alloc.lotId },
          include: { purchase: true },
        });

        if (!lot) {
          throw new NotFoundError(`Lot with ID '${alloc.lotId}' not found`);
        }

        const remaining = new Decimal(lot.remainingWeightKg.toString());
        const toAllocate = new Decimal(alloc.allocatedKg);

        if (toAllocate.greaterThan(remaining)) {
          throw new BadRequestError(
            `Cannot allocate ${alloc.allocatedKg}kg from Lot ${lot.lotNumber}. Available: ${remaining}kg.`
          );
        }

        const newRemaining = remaining.minus(toAllocate);
        const newAllocated = new Decimal(lot.allocatedWeightKg.toString()).plus(toAllocate);

        await tx.paddyLot.update({
          where: { id: alloc.lotId },
          data: {
            allocatedWeightKg: newAllocated.toNumber(),
            remainingWeightKg: newRemaining.toNumber(),
            isExhausted: newRemaining.isZero(),
          },
        });
      }

      // 2. Create Truck Dispatch
      const dispatch = await tx.truckDispatch.create({
        data: {
          dispatchNumber: input.dispatchNumber,
          millId: input.millId,
          contractId: input.contractId,
          dispatchDate: input.dispatchDate ? new Date(input.dispatchDate) : new Date(),
          truckNumber: input.truckNumber,
          driverName: input.driverName,
          driverPhone: input.driverPhone && input.driverPhone.trim().length > 0 ? input.driverPhone.trim() : null,
          totalSacks: input.totalSacks,
          grossWeightKg: input.grossWeightKg,
          tareWeightKg: input.tareWeightKg,
          netWeightKg: netWeight.toNumber(),
          transportCost: input.transportCost,
          loadingLaborCost: input.loadingLaborCost,
          otherExpenses: input.otherExpenses,
          status: 'IN_TRANSIT',
          createdById: userId,
          allocations: {
            create: input.allocations.map((a) => ({
              lotId: a.lotId,
              allocatedKg: a.allocatedKg,
              sacksCount: a.sacksCount,
            })),
          },
        },
        include: {
          allocations: true,
        },
      });

      return dispatch;
    });
  }

  static async update(id: string, input: UpdateDispatchInput) {
    await this.getById(id);
    return prisma.truckDispatch.update({
      where: { id },
      data: {
        ...(input.truckNumber ? { truckNumber: input.truckNumber } : {}),
        ...(input.driverName ? { driverName: input.driverName } : {}),
        ...(input.driverPhone !== undefined
          ? { driverPhone: input.driverPhone && input.driverPhone.trim().length > 0 ? input.driverPhone.trim() : null }
          : {}),
        ...(input.transportCost !== undefined ? { transportCost: input.transportCost } : {}),
        ...(input.loadingLaborCost !== undefined ? { loadingLaborCost: input.loadingLaborCost } : {}),
        ...(input.otherExpenses !== undefined ? { otherExpenses: input.otherExpenses } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  static async delete(id: string) {
    const dispatch = await prisma.truckDispatch.findUnique({
      where: { id },
      include: {
        settlement: true,
        allocations: {
          include: { lot: true },
        },
      },
    });

    if (!dispatch) {
      throw new NotFoundError('Truck dispatch record not found');
    }

    if (dispatch.settlement) {
      throw new BadRequestError(
        'Cannot delete dispatch because it has already been reconciled with the mill. Please remove the settlement first.',
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Return allocated stock back to lots
      for (const alloc of dispatch.allocations) {
        const lot = await tx.paddyLot.findUnique({ where: { id: alloc.lotId } });
        if (lot) {
          const allocKg = new Decimal(alloc.allocatedKg.toString());
          const newAllocated = new Decimal(lot.allocatedWeightKg.toString()).minus(allocKg);
          const newRemaining = new Decimal(lot.remainingWeightKg.toString()).plus(allocKg);

          await tx.paddyLot.update({
            where: { id: lot.id },
            data: {
              allocatedWeightKg: Math.max(0, newAllocated.toNumber()),
              remainingWeightKg: newRemaining.toNumber(),
              isExhausted: false,
            },
          });
        }
      }

      // 2. Delete allocations
      await tx.dispatchAllocation.deleteMany({
        where: { dispatchId: id },
      });

      // 3. Delete dispatch record
      return tx.truckDispatch.delete({
        where: { id },
      });
    });
  }
}
