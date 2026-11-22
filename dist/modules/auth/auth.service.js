"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../../config/database");
const env_1 = require("../../config/env");
const appError_1 = require("../../utils/appError");
class AuthService {
    static async register(input, currentUserId) {
        const existing = await database_1.prisma.user.findUnique({
            where: { username: input.username },
        });
        if (existing) {
            throw new appError_1.ConflictError('Username already taken');
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(input.password, salt);
        const user = await database_1.prisma.user.create({
            data: {
                username: input.username,
                fullName: input.fullName,
                passwordHash,
                role: input.role,
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        return user;
    }
    static async login(input) {
        const user = await database_1.prisma.user.findUnique({
            where: { username: input.username },
        });
        if (!user || !user.isActive) {
            throw new appError_1.UnauthorizedError('Invalid username or account is deactivated');
        }
        const isMatch = await bcryptjs_1.default.compare(input.password, user.passwordHash);
        if (!isMatch) {
            throw new appError_1.UnauthorizedError('Invalid credentials');
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, env_1.env.JWT_SECRET, { expiresIn: env_1.env.JWT_EXPIRES_IN });
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
            },
        };
    }
    static async getMe(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        if (!user) {
            throw new appError_1.UnauthorizedError('User not found');
        }
        return user;
    }
}
exports.AuthService = AuthService;
