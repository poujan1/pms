"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const report_service_1 = require("./report.service");
const apiResponse_1 = require("../../utils/apiResponse");
class ReportController {
    static async getDashboardSummary(_req, res, next) {
        try {
            const summary = await report_service_1.ReportService.getDashboardSummary();
            return (0, apiResponse_1.sendResponse)({ res, data: summary });
        }
        catch (error) {
            next(error);
        }
    }
    static async getDispatchProfitLoss(req, res, next) {
        try {
            const report = await report_service_1.ReportService.getDispatchProfitLoss(req.params.dispatchId);
            return (0, apiResponse_1.sendResponse)({ res, data: report });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ReportController = ReportController;
