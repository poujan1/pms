"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const apiResponse_1 = require("../../utils/apiResponse");
class AuthController {
    static async register(req, res, next) {
        try {
            const user = await auth_service_1.AuthService.register(req.body, req.user?.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'User created successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async login(req, res, next) {
        try {
            const result = await auth_service_1.AuthService.login(req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                message: 'Logged in successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMe(req, res, next) {
        try {
            const user = await auth_service_1.AuthService.getMe(req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                message: 'Profile fetched successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
