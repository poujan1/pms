"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const appError_1 = require("../utils/appError");
const env_1 = require("../config/env");
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof appError_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors,
            stack: env_1.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
        return;
    }
    // Handle unexpected errors
    console.error('💥 Unhandled Exception:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        stack: env_1.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
exports.errorHandler = errorHandler;
