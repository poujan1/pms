import { Router } from 'express';
import { DispatchController } from './dispatch.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createDispatchSchema, updateDispatchSchema } from './dispatch.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', DispatchController.list);
router.get('/available-lots', DispatchController.getAvailableLots);
router.get('/:id', DispatchController.getById);

router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER, Role.EMPLOYEE]),
  validateRequest({ body: createDispatchSchema }),
  DispatchController.create
);

router.put(
  '/:id',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: updateDispatchSchema }),
  DispatchController.update
);

export default router;
