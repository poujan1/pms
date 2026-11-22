"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logHarvesterWorkSchema = exports.createMachineSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createMachineSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    operatorName: zod_1.z.string().min(1).max(100),
    operatorPhone: zod_1.z.string().optional(),
});
exports.logHarvesterWorkSchema = zod_1.z.object({
    workDate: zod_1.z.string().optional().nullable(),
    farmerId: zod_1.z.string().uuid(),
    machineId: zod_1.z.string().uuid(),
    workQuantity: zod_1.z.number().positive('Work quantity must be greater than 0'),
    ratePerUnit: zod_1.z.number().positive('Rate must be greater than 0'),
    chargeHandling: zod_1.z.nativeEnum(client_1.HarvesterChargeHandling),
    notes: zod_1.z.string().optional(),
});
