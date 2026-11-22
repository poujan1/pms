import { Router } from 'express';
import { LedgerController } from './ledger.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createAdjustmentSchema, statementQuerySchema } from './ledger.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// 1. Farmer Ledgers
router.get('/farmers/summary', LedgerController.getAllFarmersSummary);
router.get(
  '/farmers/:farmerId/statement',
  validateRequest({ query: statementQuerySchema }),
  LedgerController.getFarmerStatement
);

// 2. Mill Ledgers
router.get('/mills/summary', LedgerController.getAllMillsSummary);
router.get(
  '/mills/:millId/statement',
  validateRequest({ query: statementQuerySchema }),
  LedgerController.getMillStatement
);

// 3. Manual Journal Adjustments (Owner / Manager only)
router.post(
  '/adjustments',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createAdjustmentSchema }),
  LedgerController.createAdjustment
);

export default router;
