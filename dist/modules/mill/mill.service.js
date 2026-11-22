"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MillService = void 0;
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const client_1 = require("@prisma/client");
class MillService {
    static async list(search) {
        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                    { location: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                ],
            }
            : {};
        return database_1.prisma.riceMill.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { dispatches: true, settlements: true, contracts: true },
                },
            },
        });
    }
    static async getById(id) {
        const mill = await database_1.prisma.riceMill.findUnique({
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
            throw new appError_1.NotFoundError('Rice mill not found');
        }
        return mill;
    }
    static async create(input) {
        const existing = await database_1.prisma.riceMill.findUnique({
            where: { code: input.code },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Rice Mill with code '${input.code}' already exists`);
        }
        return database_1.prisma.$transaction(async (tx) => {
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
                        amount: new client_1.Prisma.Decimal(Math.abs(input.openingBalance)),
                        balanceAfter: new client_1.Prisma.Decimal(input.openingBalance),
                        referenceType: 'ADJUSTMENT',
                        referenceId: mill.id,
                        description: 'Opening balance migration',
                    },
                });
            }
            return mill;
        });
    }
    static async update(id, input) {
        await this.getById(id);
        return database_1.prisma.riceMill.update({
            where: { id },
            data: input,
        });
    }
    static async createContract(millId, input) {
        await this.getById(millId);
        const existing = await database_1.prisma.millContract.findUnique({
            where: { contractNumber: input.contractNumber },
        });
        if (existing) {
            throw new appError_1.ConflictError(`Contract '${input.contractNumber}' already exists`);
        }
        return database_1.prisma.millContract.create({
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
    static async getLedger(millId, fromDate, toDate) {
        await this.getById(millId);
        const where = {
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
        const entries = await database_1.prisma.ledgerEntry.findMany({
            where,
            orderBy: { transactionDate: 'asc' },
        });
        const latestEntry = await database_1.prisma.ledgerEntry.findFirst({
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
exports.MillService = MillService;
