import { Router } from 'express';
import { MillController } from './mill.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createMillSchema, updateMillSchema, createContractSchema } from './mill.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', MillController.list);
router.get('/:id', MillController.getById);
router.get('/:id/ledger', MillController.getLedger);

router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createMillSchema }),
  MillController.create
);

router.put(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: updateMillSchema }),
  MillController.update
);

router.post(
  '/:id/contracts',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createContractSchema }),
  MillController.createContract
);

export default router;
