"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmerController = void 0;
const farmer_service_1 = require("./farmer.service");
const apiResponse_1 = require("../../utils/apiResponse");
class FarmerController {
    static async list(req, res, next) {
        try {
            const search = req.query.search;
            const farmers = await farmer_service_1.FarmerService.list(search);
            return (0, apiResponse_1.sendResponse)({ res, data: farmers });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const farmer = await farmer_service_1.FarmerService.getById(req.params.id);
            return (0, apiResponse_1.sendResponse)({ res, data: farmer });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const farmer = await farmer_service_1.FarmerService.create(req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Farmer registered successfully',
                data: farmer,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const farmer = await farmer_service_1.FarmerService.update(req.params.id, req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                message: 'Farmer updated successfully',
                data: farmer,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getLedger(req, res, next) {
        try {
            const { fromDate, toDate } = req.query;
            const ledger = await farmer_service_1.FarmerService.getLedger(req.params.id, fromDate, toDate);
            return (0, apiResponse_1.sendResponse)({ res, data: ledger });
        }
        catch (error) {
            next(error);
        }
    }
    static async recordAdvance(req, res, next) {
        try {
            const advance = await farmer_service_1.FarmerService.recordAdvance(req.params.id, req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Advance recorded and posted to ledger',
                data: advance,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.FarmerController = FarmerController;
