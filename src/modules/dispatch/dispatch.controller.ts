import { Request, Response, NextFunction } from 'express';
import { DispatchService } from './dispatch.service';
import { sendResponse } from '../../utils/apiResponse';

export class DispatchController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const dispatches = await DispatchService.list(req.query);
      return sendResponse({ res, data: dispatches });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const dispatch = await DispatchService.getById(req.params.id);
      return sendResponse({ res, data: dispatch });
    } catch (error) {
      next(error);
    }
  }

  static async getAvailableLots(req: Request, res: Response, next: NextFunction) {
    try {
      const lots = await DispatchService.getAvailableLots();
      return sendResponse({ res, data: lots });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dispatch = await DispatchService.create(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Truck dispatch created, lot stock allocated and set to in-transit',
        data: dispatch,
      });
    } catch (error) {
      next(error);
    }
  }
}
