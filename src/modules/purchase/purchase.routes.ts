import { Router } from 'express';
import { PurchaseController } from './purchase.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createPurchaseSchema, updatePurchaseSchema } from './purchase.schema';
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

router.put(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: updatePurchaseSchema }),
  PurchaseController.update
);

router.delete(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  PurchaseController.delete
);

export default router;
