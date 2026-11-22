"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const farmer_routes_1 = __importDefault(require("./modules/farmer/farmer.routes"));
const mill_routes_1 = __importDefault(require("./modules/mill/mill.routes"));
const harvester_routes_1 = __importDefault(require("./modules/harvester/harvester.routes"));
const purchase_routes_1 = __importDefault(require("./modules/purchase/purchase.routes"));
const dispatch_routes_1 = __importDefault(require("./modules/dispatch/dispatch.routes"));
const settlement_routes_1 = __importDefault(require("./modules/settlement/settlement.routes"));
const payment_routes_1 = __importDefault(require("./modules/payment/payment.routes"));
const expense_routes_1 = __importDefault(require("./modules/expense/expense.routes"));
const report_routes_1 = __importDefault(require("./modules/report/report.routes"));
const ledger_routes_1 = __importDefault(require("./modules/ledger/ledger.routes"));
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Paddy Management System API',
    });
});
router.use('/auth', auth_routes_1.default);
router.use('/farmers', farmer_routes_1.default);
router.use('/mills', mill_routes_1.default);
router.use('/harvester', harvester_routes_1.default);
router.use('/purchases', purchase_routes_1.default);
router.use('/dispatches', dispatch_routes_1.default);
router.use('/settlements', settlement_routes_1.default);
router.use('/payments', payment_routes_1.default);
router.use('/expenses', expense_routes_1.default);
router.use('/reports', report_routes_1.default);
router.use('/ledgers', ledger_routes_1.default);
exports.default = router;
