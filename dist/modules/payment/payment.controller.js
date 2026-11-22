"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const payment_service_1 = require("./payment.service");
const apiResponse_1 = require("../../utils/apiResponse");
class PaymentController {
    static async list(req, res, next) {
        try {
            const payments = await payment_service_1.PaymentService.list(req.query);
            return (0, apiResponse_1.sendResponse)({ res, data: payments });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const payment = await payment_service_1.PaymentService.getById(req.params.id);
            return (0, apiResponse_1.sendResponse)({ res, data: payment });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const payment = await payment_service_1.PaymentService.create(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Payment recorded and ledger updated successfully',
                data: payment,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const payment = await payment_service_1.PaymentService.update(req.params.id, req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                message: 'Payment updated and ledger re-balanced successfully',
                data: payment,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const deleted = await payment_service_1.PaymentService.delete(req.params.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                message: 'Payment voucher deleted and ledger rolled back successfully',
                data: deleted,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PaymentController = PaymentController;
