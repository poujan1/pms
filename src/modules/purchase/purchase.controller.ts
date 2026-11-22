import { Request, Response, NextFunction } from 'express';
import { PurchaseService } from './purchase.service';
import { sendResponse } from '../../utils/apiResponse';

export class PurchaseController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const purchases = await PurchaseService.list(req.query);
      return sendResponse({ res, data: purchases });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.getById(req.params.id);
      return sendResponse({ res, data: purchase });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.create(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Paddy purchase recorded, lot created, and posted to ledger',
        data: purchase,
      });
    } catch (error) {
      next(error);
    }
  }
}
