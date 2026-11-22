"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HarvesterController = void 0;
const harvester_service_1 = require("./harvester.service");
const apiResponse_1 = require("../../utils/apiResponse");
class HarvesterController {
    static async listMachines(req, res, next) {
        try {
            const machines = await harvester_service_1.HarvesterService.listMachines();
            return (0, apiResponse_1.sendResponse)({ res, data: machines });
        }
        catch (error) {
            next(error);
        }
    }
    static async createMachine(req, res, next) {
        try {
            const machine = await harvester_service_1.HarvesterService.createMachine(req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Harvester Machine registered successfully',
                data: machine,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listWorkLogs(req, res, next) {
        try {
            const { farmerId, machineId } = req.query;
            const logs = await harvester_service_1.HarvesterService.listWorkLogs(farmerId, machineId);
            return (0, apiResponse_1.sendResponse)({ res, data: logs });
        }
        catch (error) {
            next(error);
        }
    }
    static async logWork(req, res, next) {
        try {
            const log = await harvester_service_1.HarvesterService.logWork(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Harvester work recorded and posted',
                data: log,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.HarvesterController = HarvesterController;
