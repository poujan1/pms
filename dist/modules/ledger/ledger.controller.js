"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerController = void 0;
const ledger_service_1 = require("./ledger.service");
const apiResponse_1 = require("../../utils/apiResponse");
class LedgerController {
    static async getFarmerStatement(req, res, next) {
        try {
            const { fromDate, toDate } = req.query;
            const statement = await ledger_service_1.LedgerService.getFarmerStatement(req.params.farmerId, fromDate, toDate);
            return (0, apiResponse_1.sendResponse)({ res, data: statement });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMillStatement(req, res, next) {
        try {
            const { fromDate, toDate } = req.query;
            const statement = await ledger_service_1.LedgerService.getMillStatement(req.params.millId, fromDate, toDate);
            return (0, apiResponse_1.sendResponse)({ res, data: statement });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAllFarmersSummary(_req, res, next) {
        try {
            const summary = await ledger_service_1.LedgerService.getAllFarmersLedgerSummary();
            return (0, apiResponse_1.sendResponse)({ res, data: summary });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAllMillsSummary(_req, res, next) {
        try {
            const summary = await ledger_service_1.LedgerService.getAllMillsLedgerSummary();
            return (0, apiResponse_1.sendResponse)({ res, data: summary });
        }
        catch (error) {
            next(error);
        }
    }
    static async createAdjustment(req, res, next) {
        try {
            const adjustment = await ledger_service_1.LedgerService.createAdjustment(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Manual ledger adjustment posted successfully',
                data: adjustment,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.LedgerController = LedgerController;
