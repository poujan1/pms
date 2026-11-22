import { Request, Response, NextFunction } from 'express';
import { SettlementService } from './settlement.service';
import { sendResponse } from '../../utils/apiResponse';

export class SettlementController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const settlements = await SettlementService.list(req.query);
      return sendResponse({ res, data: settlements });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const settlement = await SettlementService.getById(req.params.id);
      return sendResponse({ res, data: settlement });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const settlement = await SettlementService.create(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Mill settlement recorded, deductions calculated, and posted to mill receivable ledger',
        data: settlement,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const settlement = await SettlementService.update(req.params.id, req.body, req.user!.id);
      return sendResponse({
        res,
        message: 'Mill settlement updated, deductions recalculated, and mill ledger re-balanced',
        data: settlement,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = await SettlementService.delete(req.params.id);
      return sendResponse({
        res,
        message: 'Mill settlement deleted, dispatch returned to in-transit, and mill ledger re-balanced',
        data: deleted,
      });
    } catch (error) {
      next(error);
    }
  }
}
