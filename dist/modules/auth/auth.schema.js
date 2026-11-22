"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(50),
    fullName: zod_1.z.string().min(2).max(100),
    password: zod_1.z.string().min(6),
    role: zod_1.z.nativeEnum(client_1.Role).default(client_1.Role.EMPLOYEE),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
