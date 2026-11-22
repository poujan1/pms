import { Router } from 'express';
import { ReportController } from './report.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/dashboard-summary', ReportController.getDashboardSummary);
router.get(
  '/dispatch-pnl/:dispatchId',
  authorize([Role.OWNER, Role.MANAGER]),
  ReportController.getDispatchProfitLoss
);

export default router;
