"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MillController = void 0;
const mill_service_1 = require("./mill.service");
const apiResponse_1 = require("../../utils/apiResponse");
class MillController {
    static async list(req, res, next) {
        try {
            const search = req.query.search;
            const mills = await mill_service_1.MillService.list(search);
            return (0, apiResponse_1.sendResponse)({ res, data: mills });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const mill = await mill_service_1.MillService.getById(req.params.id);
            return (0, apiResponse_1.sendResponse)({ res, data: mill });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const mill = await mill_service_1.MillService.create(req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Rice Mill registered successfully',
                data: mill,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const mill = await mill_service_1.MillService.update(req.params.id, req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                message: 'Rice Mill updated successfully',
                data: mill,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createContract(req, res, next) {
        try {
            const contract = await mill_service_1.MillService.createContract(req.params.id, req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Contract created successfully',
                data: contract,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getLedger(req, res, next) {
        try {
            const { fromDate, toDate } = req.query;
            const ledger = await mill_service_1.MillService.getLedger(req.params.id, fromDate, toDate);
            return (0, apiResponse_1.sendResponse)({ res, data: ledger });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MillController = MillController;
