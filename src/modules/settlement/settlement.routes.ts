import { Router } from 'express';
import { SettlementController } from './settlement.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createSettlementSchema } from './settlement.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', SettlementController.list);
router.get('/:id', SettlementController.getById);

router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createSettlementSchema }),
  SettlementController.create
);

export default router;
