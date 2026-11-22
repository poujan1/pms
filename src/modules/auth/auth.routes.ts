import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { loginSchema, registerSchema } from './auth.schema';
import { Role } from '@prisma/client';

const router = Router();

router.post('/login', validateRequest({ body: loginSchema }), AuthController.login);
router.get('/me', authenticate, AuthController.getMe);
router.post(
  '/register',
  authenticate,
  authorize([Role.OWNER]),
  validateRequest({ body: registerSchema }),
  AuthController.register
);

export default router;
