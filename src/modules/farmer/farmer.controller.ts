import { Request, Response, NextFunction } from 'express';
import { FarmerService } from './farmer.service';
import { sendResponse } from '../../utils/apiResponse';

export class FarmerController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const farmers = await FarmerService.list(search);
      return sendResponse({ res, data: farmers });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const farmer = await FarmerService.getById(req.params.id);
      return sendResponse({ res, data: farmer });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const farmer = await FarmerService.create(req.body);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Farmer registered successfully',
        data: farmer,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const farmer = await FarmerService.update(req.params.id, req.body);
      return sendResponse({
        res,
        message: 'Farmer updated successfully',
        data: farmer,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
      const ledger = await FarmerService.getLedger(req.params.id, fromDate, toDate);
      return sendResponse({ res, data: ledger });
    } catch (error) {
      next(error);
    }
  }

  static async recordAdvance(req: Request, res: Response, next: NextFunction) {
    try {
      const advance = await FarmerService.recordAdvance(req.params.id, req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Advance recorded and posted to ledger',
        data: advance,
      });
    } catch (error) {
      next(error);
    }
  }
}
