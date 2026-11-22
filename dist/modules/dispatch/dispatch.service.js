"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const numberUtils_1 = require("../../utils/numberUtils");
const decimal_js_1 = require("decimal.js");
class DispatchService {
    static async list(params) {
        const where = {
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
        return database_1.prisma.truckDispatch.findMany({
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
    static async getById(id) {
        const dispatch = await database_1.prisma.truckDispatch.findUnique({
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
            throw new appError_1.NotFoundError('Truck dispatch record not found');
        }
        return dispatch;
    }
    static async getAvailableLots() {
        return database_1.prisma.paddyLot.findMany({
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
    static async create(input, userId) {
        const mill = await database_1.prisma.riceMill.findUnique({ where: { id: input.millId } });
        if (!mill)
            throw new appError_1.NotFoundError('Rice mill not found');
        const existing = await database_1.prisma.truckDispatch.findUnique({
            where: { dispatchNumber: input.dispatchNumber },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Dispatch number '${input.dispatchNumber}' is already in use`);
        }
        const netWeight = (0, numberUtils_1.calculateNetWeight)(input.grossWeightKg, input.tareWeightKg);
        // Sum of allocated kg must match or be reasonable vs net weight
        let totalAllocatedKg = new decimal_js_1.Decimal(0);
        for (const alloc of input.allocations) {
            totalAllocatedKg = totalAllocatedKg.plus(alloc.allocatedKg);
        }
        // Execute in transaction: validate each lot's available balance and deduct
        return database_1.prisma.$transaction(async (tx) => {
            // 1. Validate & Reserve Lots
            for (const alloc of input.allocations) {
                const lot = await tx.paddyLot.findUnique({
                    where: { id: alloc.lotId },
                    include: { purchase: true },
                });
                if (!lot) {
                    throw new appError_1.NotFoundError(`Lot with ID '${alloc.lotId}' not found`);
                }
                const remaining = new decimal_js_1.Decimal(lot.remainingWeightKg.toString());
                const toAllocate = new decimal_js_1.Decimal(alloc.allocatedKg);
                if (toAllocate.greaterThan(remaining)) {
                    throw new appError_1.BadRequestError(`Cannot allocate ${alloc.allocatedKg}kg from Lot ${lot.lotNumber}. Available: ${remaining}kg.`);
                }
                const newRemaining = remaining.minus(toAllocate);
                const newAllocated = new decimal_js_1.Decimal(lot.allocatedWeightKg.toString()).plus(toAllocate);
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
                    driverPhone: input.driverPhone,
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
    static async update(id, input) {
        await this.getById(id);
        return database_1.prisma.truckDispatch.update({
            where: { id },
            data: {
                ...(input.truckNumber ? { truckNumber: input.truckNumber } : {}),
                ...(input.driverName ? { driverName: input.driverName } : {}),
                ...(input.driverPhone !== undefined ? { driverPhone: input.driverPhone } : {}),
                ...(input.transportCost !== undefined ? { transportCost: input.transportCost } : {}),
                ...(input.loadingLaborCost !== undefined ? { loadingLaborCost: input.loadingLaborCost } : {}),
                ...(input.otherExpenses !== undefined ? { otherExpenses: input.otherExpenses } : {}),
                ...(input.notes !== undefined ? { notes: input.notes } : {}),
            },
        });
    }
}
exports.DispatchService = DispatchService;
