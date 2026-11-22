"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ledger_controller_1 = require("./ledger.controller");
const validate_1 = require("../../middlewares/validate");
const auth_1 = require("../../middlewares/auth");
const ledger_schema_1 = require("./ledger.schema");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// 1. Farmer Ledgers
router.get('/farmers/summary', ledger_controller_1.LedgerController.getAllFarmersSummary);
router.get('/farmers/:farmerId/statement', (0, validate_1.validateRequest)({ query: ledger_schema_1.statementQuerySchema }), ledger_controller_1.LedgerController.getFarmerStatement);
// 2. Mill Ledgers
router.get('/mills/summary', ledger_controller_1.LedgerController.getAllMillsSummary);
router.get('/mills/:millId/statement', (0, validate_1.validateRequest)({ query: ledger_schema_1.statementQuerySchema }), ledger_controller_1.LedgerController.getMillStatement);
// 3. Manual Journal Adjustments (Owner / Manager only)
router.post('/adjustments', (0, auth_1.authorize)([client_1.Role.OWNER, client_1.Role.MANAGER]), (0, validate_1.validateRequest)({ body: ledger_schema_1.createAdjustmentSchema }), ledger_controller_1.LedgerController.createAdjustment);
exports.default = router;
