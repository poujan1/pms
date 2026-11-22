import { Request, Response, NextFunction } from 'express';
import { ReportService } from './report.service';
import { sendResponse } from '../../utils/apiResponse';

export class ReportController {
  static async getDashboardSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getDashboardSummary();
      return sendResponse({ res, data: summary });
    } catch (error) {
      next(error);
    }
  }

  static async getDispatchProfitLoss(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportService.getDispatchProfitLoss(req.params.dispatchId);
      return sendResponse({ res, data: report });
    } catch (error) {
      next(error);
    }
  }
}
