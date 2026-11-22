"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const server = app_1.default.listen(env_1.env.PORT, async () => {
    try {
        await database_1.prisma.$connect();
        console.log(`🌾 Paddy Management System (PMS) Backend running on port ${env_1.env.PORT}`);
        console.log(`🌍 Environment: ${env_1.env.NODE_ENV}`);
        console.log(`🔌 Database connected successfully`);
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
    }
});
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
        await database_1.prisma.$disconnect();
        console.log('HTTP server and database connections closed');
    });
});
