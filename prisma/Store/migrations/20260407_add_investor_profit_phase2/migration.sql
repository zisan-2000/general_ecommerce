CREATE TYPE "InvestorProfitRunStatus" AS ENUM (
  'COMPLETED'
);

CREATE TYPE "InvestorProfitExpenseAllocationBasis" AS ENUM (
  'NET_REVENUE',
  'NET_UNITS'
);

CREATE TABLE "InvestorProfitRun" (
  "id" SERIAL NOT NULL,
  "runNumber" TEXT NOT NULL,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "status" "InvestorProfitRunStatus" NOT NULL DEFAULT 'COMPLETED',
  "allocationBasis" "InvestorProfitExpenseAllocationBasis" NOT NULL,
  "marketingExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "adsExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "logisticsExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "otherExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalOperatingExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNetRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNetCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNetProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestorProfitRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorProfitRunVariant" (
  "id" SERIAL NOT NULL,
  "runId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "unitsSold" INTEGER NOT NULL DEFAULT 0,
  "unitsRefunded" INTEGER NOT NULL DEFAULT 0,
  "unitsNet" INTEGER NOT NULL DEFAULT 0,
  "grossRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grossCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "refundCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "allocatedExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "unallocatedSharePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestorProfitRunVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorProfitRunAllocation" (
  "id" SERIAL NOT NULL,
  "runId" INTEGER NOT NULL,
  "variantLineId" INTEGER NOT NULL,
  "investorId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "sourceAllocationId" INTEGER,
  "participationSharePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "allocatedRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "allocatedNetProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestorProfitRunAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestorProfitRun_runNumber_key" ON "InvestorProfitRun"("runNumber");
CREATE INDEX "InvestorProfitRun_fromDate_toDate_idx" ON "InvestorProfitRun"("fromDate", "toDate");
CREATE INDEX "InvestorProfitRun_createdAt_idx" ON "InvestorProfitRun"("createdAt");
CREATE INDEX "InvestorProfitRun_createdById_idx" ON "InvestorProfitRun"("createdById");

CREATE UNIQUE INDEX "InvestorProfitRunVariant_runId_productVariantId_key"
  ON "InvestorProfitRunVariant"("runId", "productVariantId");
CREATE INDEX "InvestorProfitRunVariant_runId_netProfit_idx"
  ON "InvestorProfitRunVariant"("runId", "netProfit");
CREATE INDEX "InvestorProfitRunVariant_productVariantId_idx"
  ON "InvestorProfitRunVariant"("productVariantId");

CREATE INDEX "InvestorProfitRunAllocation_runId_investorId_idx"
  ON "InvestorProfitRunAllocation"("runId", "investorId");
CREATE INDEX "InvestorProfitRunAllocation_runId_productVariantId_idx"
  ON "InvestorProfitRunAllocation"("runId", "productVariantId");
CREATE INDEX "InvestorProfitRunAllocation_sourceAllocationId_idx"
  ON "InvestorProfitRunAllocation"("sourceAllocationId");

ALTER TABLE "InvestorProfitRun"
  ADD CONSTRAINT "InvestorProfitRun_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunVariant"
  ADD CONSTRAINT "InvestorProfitRunVariant_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "InvestorProfitRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunVariant"
  ADD CONSTRAINT "InvestorProfitRunVariant_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunAllocation"
  ADD CONSTRAINT "InvestorProfitRunAllocation_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "InvestorProfitRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunAllocation"
  ADD CONSTRAINT "InvestorProfitRunAllocation_variantLineId_fkey"
  FOREIGN KEY ("variantLineId") REFERENCES "InvestorProfitRunVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunAllocation"
  ADD CONSTRAINT "InvestorProfitRunAllocation_investorId_fkey"
  FOREIGN KEY ("investorId") REFERENCES "Investor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunAllocation"
  ADD CONSTRAINT "InvestorProfitRunAllocation_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRunAllocation"
  ADD CONSTRAINT "InvestorProfitRunAllocation_sourceAllocationId_fkey"
  FOREIGN KEY ("sourceAllocationId") REFERENCES "InvestorProductAllocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
