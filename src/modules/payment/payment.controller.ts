import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { sendResponse } from '../../utils/apiResponse';

export class PaymentController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const payments = await PaymentService.list(req.query);
      return sendResponse({ res, data: payments });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentService.create(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Payment recorded and ledger updated successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }
}
