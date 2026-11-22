"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseController = void 0;
const purchase_service_1 = require("./purchase.service");
const apiResponse_1 = require("../../utils/apiResponse");
class PurchaseController {
    static async list(req, res, next) {
        try {
            const purchases = await purchase_service_1.PurchaseService.list(req.query);
            return (0, apiResponse_1.sendResponse)({ res, data: purchases });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const purchase = await purchase_service_1.PurchaseService.getById(req.params.id);
            return (0, apiResponse_1.sendResponse)({ res, data: purchase });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const purchase = await purchase_service_1.PurchaseService.create(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Paddy purchase recorded, lot created, and posted to ledger',
                data: purchase,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PurchaseController = PurchaseController;
