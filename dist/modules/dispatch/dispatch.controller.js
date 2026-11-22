"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchController = void 0;
const dispatch_service_1 = require("./dispatch.service");
const apiResponse_1 = require("../../utils/apiResponse");
class DispatchController {
    static async list(req, res, next) {
        try {
            const dispatches = await dispatch_service_1.DispatchService.list(req.query);
            return (0, apiResponse_1.sendResponse)({ res, data: dispatches });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const dispatch = await dispatch_service_1.DispatchService.getById(req.params.id);
            return (0, apiResponse_1.sendResponse)({ res, data: dispatch });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAvailableLots(req, res, next) {
        try {
            const lots = await dispatch_service_1.DispatchService.getAvailableLots();
            return (0, apiResponse_1.sendResponse)({ res, data: lots });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const dispatch = await dispatch_service_1.DispatchService.create(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Truck dispatch created, lot stock allocated and set to in-transit',
                data: dispatch,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DispatchController = DispatchController;
