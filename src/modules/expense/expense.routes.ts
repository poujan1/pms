import { Router } from 'express';
import { ExpenseController } from './expense.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createCategorySchema, createExpenseSchema, updateExpenseSchema } from './expense.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/summary', ExpenseController.getExpenseSummary);
router.get('/categories', ExpenseController.listCategories);
router.post(
  '/categories',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createCategorySchema }),
  ExpenseController.createCategory
);

router.get('/', ExpenseController.listExpenses);
router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER, Role.EMPLOYEE]),
  validateRequest({ body: createExpenseSchema }),
  ExpenseController.createExpense
);

router.put(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER, Role.EMPLOYEE]),
  validateRequest({ body: updateExpenseSchema }),
  ExpenseController.updateExpense
);

router.delete(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  ExpenseController.deleteExpense
);

export default router;
