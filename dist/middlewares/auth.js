"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const appError_1 = require("../utils/appError");
const authenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new appError_1.UnauthorizedError('Authorization token required');
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        throw new appError_1.UnauthorizedError('Invalid or expired token');
    }
};
exports.authenticate = authenticate;
const authorize = (allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            throw new appError_1.UnauthorizedError('Authentication required');
        }
        if (!allowedRoles.includes(req.user.role)) {
            throw new appError_1.ForbiddenError(`Access denied for role: ${req.user.role}`);
        }
        next();
    };
};
exports.authorize = authorize;
