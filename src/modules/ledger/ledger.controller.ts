import { Request, Response, NextFunction } from 'express';
import { LedgerService } from './ledger.service';
import { sendResponse } from '../../utils/apiResponse';

export class LedgerController {
  static async getFarmerStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
      const statement = await LedgerService.getFarmerStatement(req.params.farmerId, fromDate, toDate);
      return sendResponse({ res, data: statement });
    } catch (error) {
      next(error);
    }
  }

  static async getMillStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
      const statement = await LedgerService.getMillStatement(req.params.millId, fromDate, toDate);
      return sendResponse({ res, data: statement });
    } catch (error) {
      next(error);
    }
  }

  static async getAllFarmersSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await LedgerService.getAllFarmersLedgerSummary();
      return sendResponse({ res, data: summary });
    } catch (error) {
      next(error);
    }
  }

  static async getAllMillsSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await LedgerService.getAllMillsLedgerSummary();
      return sendResponse({ res, data: summary });
    } catch (error) {
      next(error);
    }
  }

  static async createAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const adjustment = await LedgerService.createAdjustment(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Manual ledger adjustment posted successfully',
        data: adjustment,
      });
    } catch (error) {
      next(error);
    }
  }
}
