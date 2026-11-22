-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('OPEN', 'FULFILLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('KG', 'QUINTAL');

-- CreateEnum
CREATE TYPE "HarvesterChargeHandling" AS ENUM ('FARMER_DEDUCTION', 'COMPANY_EXPENSE');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('IN_TRANSIT', 'DELIVERED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('WEIGHT_CUT', 'SACK_TARE_CUT', 'PERCENTAGE_CUT', 'PER_UNIT_RATE_CUT', 'FIXED_MONEY_CUT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('FARMER', 'RICE_MILL');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rice_mills" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rice_mills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mill_contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "targetWeightKg" DECIMAL(12,3) NOT NULL,
    "ratePerKg" DECIMAL(10,2) NOT NULL,
    "maxMoisture" DECIMAL(5,2),
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mill_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvester_machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvester_machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paddy_purchases" (
    "id" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "variety" TEXT,
    "fieldLocation" TEXT,
    "sackCount" INTEGER NOT NULL,
    "grossWeightKg" DECIMAL(12,3) NOT NULL,
    "sackTareWeightKg" DECIMAL(12,3) NOT NULL,
    "netWeightKg" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "rateUnit" "RateUnit" NOT NULL DEFAULT 'KG',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paddy_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paddy_lots" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "initialWeightKg" DECIMAL(12,3) NOT NULL,
    "allocatedWeightKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "remainingWeightKg" DECIMAL(12,3) NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paddy_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvester_works" (
    "id" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "farmerId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "workQuantity" DECIMAL(8,2) NOT NULL,
    "ratePerUnit" DECIMAL(10,2) NOT NULL,
    "totalCharge" DECIMAL(12,2) NOT NULL,
    "chargeHandling" "HarvesterChargeHandling" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvester_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_advances" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmer_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck_dispatches" (
    "id" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "contractId" TEXT,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT,
    "totalSacks" INTEGER NOT NULL,
    "grossWeightKg" DECIMAL(12,3) NOT NULL,
    "tareWeightKg" DECIMAL(12,3) NOT NULL,
    "netWeightKg" DECIMAL(12,3) NOT NULL,
    "transportCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "loadingLaborCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherExpenses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "DispatchStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "truck_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_allocations" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "allocatedKg" DECIMAL(12,3) NOT NULL,
    "sacksCount" INTEGER NOT NULL,

    CONSTRAINT "dispatch_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mill_settlements" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "receivedSacks" INTEGER NOT NULL,
    "receivedWeightKg" DECIMAL(12,3) NOT NULL,
    "shortageWeightKg" DECIMAL(12,3) NOT NULL,
    "millRate" DECIMAL(10,2) NOT NULL,
    "millRateUnit" "RateUnit" NOT NULL DEFAULT 'KG',
    "finalAcceptedKg" DECIMAL(12,3) NOT NULL,
    "grossSettlementNpr" DECIMAL(14,2) NOT NULL,
    "totalDeductionsNpr" DECIMAL(14,2) NOT NULL,
    "netPayableByMill" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mill_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mill_deductions" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeductionType" NOT NULL,
    "rateOrValue" DECIMAL(10,2) NOT NULL,
    "impactInKg" DECIMAL(12,3),
    "impactInNpr" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "mill_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "farmerId" TEXT,
    "millId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "farmerId" TEXT,
    "millId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_expenses" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidTo" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "farmers_code_key" ON "farmers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rice_mills_code_key" ON "rice_mills"("code");

-- CreateIndex
CREATE UNIQUE INDEX "mill_contracts_contractNumber_key" ON "mill_contracts"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "paddy_purchases_purchaseNumber_key" ON "paddy_purchases"("purchaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "paddy_lots_lotNumber_key" ON "paddy_lots"("lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "paddy_lots_purchaseId_key" ON "paddy_lots"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "truck_dispatches_dispatchNumber_key" ON "truck_dispatches"("dispatchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "mill_settlements_dispatchId_key" ON "mill_settlements"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_voucherNumber_key" ON "payment_transactions"("voucherNumber");

-- CreateIndex
CREATE INDEX "payment_transactions_farmerId_idx" ON "payment_transactions"("farmerId");

-- CreateIndex
CREATE INDEX "payment_transactions_millId_idx" ON "payment_transactions"("millId");

-- CreateIndex
CREATE INDEX "ledger_entries_partyType_farmerId_transactionDate_idx" ON "ledger_entries"("partyType", "farmerId", "transactionDate");

-- CreateIndex
CREATE INDEX "ledger_entries_partyType_millId_transactionDate_idx" ON "ledger_entries"("partyType", "millId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- AddForeignKey
ALTER TABLE "mill_contracts" ADD CONSTRAINT "mill_contracts_millId_fkey" FOREIGN KEY ("millId") REFERENCES "rice_mills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paddy_purchases" ADD CONSTRAINT "paddy_purchases_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paddy_purchases" ADD CONSTRAINT "paddy_purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paddy_lots" ADD CONSTRAINT "paddy_lots_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "paddy_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvester_works" ADD CONSTRAINT "harvester_works_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvester_works" ADD CONSTRAINT "harvester_works_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "harvester_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_advances" ADD CONSTRAINT "farmer_advances_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_dispatches" ADD CONSTRAINT "truck_dispatches_millId_fkey" FOREIGN KEY ("millId") REFERENCES "rice_mills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_dispatches" ADD CONSTRAINT "truck_dispatches_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "mill_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_dispatches" ADD CONSTRAINT "truck_dispatches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_allocations" ADD CONSTRAINT "dispatch_allocations_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "truck_dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_allocations" ADD CONSTRAINT "dispatch_allocations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "paddy_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mill_settlements" ADD CONSTRAINT "mill_settlements_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "truck_dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mill_settlements" ADD CONSTRAINT "mill_settlements_millId_fkey" FOREIGN KEY ("millId") REFERENCES "rice_mills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mill_settlements" ADD CONSTRAINT "mill_settlements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mill_deductions" ADD CONSTRAINT "mill_deductions_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "mill_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_millId_fkey" FOREIGN KEY ("millId") REFERENCES "rice_mills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_millId_fkey" FOREIGN KEY ("millId") REFERENCES "rice_mills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
