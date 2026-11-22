import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from './expense.service';
import { sendResponse } from '../../utils/apiResponse';

export class ExpenseController {
  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await ExpenseService.listCategories();
      return sendResponse({ res, data: categories });
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await ExpenseService.createCategory(req.body);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Category created',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const expenses = await ExpenseService.listExpenses(req.query);
      return sendResponse({ res, data: expenses });
    } catch (error) {
      next(error);
    }
  }

  static async createExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await ExpenseService.createExpense(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Expense recorded successfully',
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await ExpenseService.updateExpense(req.params.id, req.body);
      return sendResponse({
        res,
        message: 'Expense record updated',
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }
}
