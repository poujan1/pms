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

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.update(req.params.id, req.body);
      return sendResponse({
        res,
        message: 'Paddy purchase updated, lot weight and ledger synchronized',
        data: purchase,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = await PurchaseService.delete(req.params.id);
      return sendResponse({
        res,
        message: 'Purchase deleted, stock lot released, and farmer ledger re-balanced',
        data: deleted,
      });
    } catch (error) {
      next(error);
    }
  }
}
