import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createPaymentSchema } from './payment.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', PaymentController.list);

router.post(
  '/',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createPaymentSchema }),
  PaymentController.create
);

export default router;
