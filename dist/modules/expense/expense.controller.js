"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseController = void 0;
const expense_service_1 = require("./expense.service");
const apiResponse_1 = require("../../utils/apiResponse");
class ExpenseController {
    static async listCategories(req, res, next) {
        try {
            const categories = await expense_service_1.ExpenseService.listCategories();
            return (0, apiResponse_1.sendResponse)({ res, data: categories });
        }
        catch (error) {
            next(error);
        }
    }
    static async createCategory(req, res, next) {
        try {
            const category = await expense_service_1.ExpenseService.createCategory(req.body);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Category created',
                data: category,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listExpenses(req, res, next) {
        try {
            const expenses = await expense_service_1.ExpenseService.listExpenses(req.query);
            return (0, apiResponse_1.sendResponse)({ res, data: expenses });
        }
        catch (error) {
            next(error);
        }
    }
    static async createExpense(req, res, next) {
        try {
            const expense = await expense_service_1.ExpenseService.createExpense(req.body, req.user.id);
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 201,
                message: 'Expense recorded successfully',
                data: expense,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ExpenseController = ExpenseController;
