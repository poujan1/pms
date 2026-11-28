import { Router } from 'express';
import { FarmerController } from './farmer.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createFarmerSchema, updateFarmerSchema, farmerAdvanceSchema } from './farmer.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', FarmerController.list);
router.get('/:id', FarmerController.getById);
router.get('/:id/ledger', FarmerController.getLedger);

router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createFarmerSchema }),
  FarmerController.create
);

router.put(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: updateFarmerSchema }),
  FarmerController.update
);

router.post(
  '/:id/advances',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: farmerAdvanceSchema }),
  FarmerController.recordAdvance
);

router.delete(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER, Role.EMPLOYEE]),
  FarmerController.delete
);

export default router;
