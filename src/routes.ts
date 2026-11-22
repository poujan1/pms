import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import farmerRoutes from './modules/farmer/farmer.routes';
import millRoutes from './modules/mill/mill.routes';
import harvesterRoutes from './modules/harvester/harvester.routes';
import purchaseRoutes from './modules/purchase/purchase.routes';
import dispatchRoutes from './modules/dispatch/dispatch.routes';
import settlementRoutes from './modules/settlement/settlement.routes';
import paymentRoutes from './modules/payment/payment.routes';
import expenseRoutes from './modules/expense/expense.routes';
import reportRoutes from './modules/report/report.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Paddy Management System API',
  });
});

router.use('/auth', authRoutes);
router.use('/farmers', farmerRoutes);
router.use('/mills', millRoutes);
router.use('/harvester', harvesterRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/dispatches', dispatchRoutes);
router.use('/settlements', settlementRoutes);
router.use('/payments', paymentRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reports', reportRoutes);
router.use('/ledgers', ledgerRoutes);

export default router;
