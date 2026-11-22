import { Router } from 'express';
import { SettlementController } from './settlement.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createSettlementSchema, updateSettlementSchema } from './settlement.schema';
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

router.put(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: updateSettlementSchema }),
  SettlementController.update
);

router.delete(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  SettlementController.delete
);

export default router;
