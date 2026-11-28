import { Request, Response, NextFunction } from 'express';
import { MillService } from './mill.service';
import { sendResponse } from '../../utils/apiResponse';

export class MillController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const mills = await MillService.list(search);
      return sendResponse({ res, data: mills });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const mill = await MillService.getById(req.params.id);
      return sendResponse({ res, data: mill });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const mill = await MillService.create(req.body);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Rice Mill registered successfully',
        data: mill,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const mill = await MillService.update(req.params.id, req.body);
      return sendResponse({
        res,
        message: 'Rice Mill updated successfully',
        data: mill,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createContract(req: Request, res: Response, next: NextFunction) {
    try {
      const contract = await MillService.createContract(req.params.id, req.body);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Contract created successfully',
        data: contract,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
      const ledger = await MillService.getLedger(req.params.id, fromDate, toDate);
      return sendResponse({ res, data: ledger });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await MillService.delete(req.params.id);
      return sendResponse({
        res,
        message: 'Rice mill deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
