import { Router } from 'express';
import { HarvesterController } from './harvester.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { createMachineSchema, logHarvesterWorkSchema } from './harvester.schema';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/machines', HarvesterController.listMachines);
router.post(
  '/machines',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: createMachineSchema }),
  HarvesterController.createMachine
);

router.get('/summary', HarvesterController.getSummary);
router.get('/work', HarvesterController.listWorkLogs);
router.post(
  '/work',
  authorize([Role.OWNER, Role.MANAGER]),
  validateRequest({ body: logHarvesterWorkSchema }),
  HarvesterController.logWork
);

export default router;
