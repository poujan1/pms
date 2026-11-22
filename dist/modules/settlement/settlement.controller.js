"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementController = void 0;
const settlement_service_1 = require("./settlement.service");
const apiResponse_1 = require("../../utils/apiResponse");
class SettlementController {
    static async list(req, res, next) {
        try {
            const settlements = await settlement_service_1.SettlementService.list(req.query);
            return (0, apiResponse_1.sendResponse)({ res, data: settlements });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const settlement = await settlement_service_1.SettlementService.getById(req.params.id);
            return (0, apiResponse_1.sendResponse)({ res, data: settlement });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const settlement = await settlement_service_1.SettlementService.create(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Mill settlement recorded, deductions calculated, and posted to mill receivable ledger',
                data: settlement,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SettlementController = SettlementController;
