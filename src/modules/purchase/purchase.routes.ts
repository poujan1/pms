import { Router } from 'express';
import { PurchaseController } from './purchase.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createPurchaseSchema } from './purchase.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', PurchaseController.list);
router.get('/:id', PurchaseController.getById);

router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER, Role.EMPLOYEE]),
  validateRequest({ body: createPurchaseSchema }),
  PurchaseController.create
);

export default router;
