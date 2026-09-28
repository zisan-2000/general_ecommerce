CREATE TYPE "InvestorStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);

CREATE TYPE "InvestorKycStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "InvestorTransactionType" AS ENUM (
  'CAPITAL_COMMITMENT',
  'CAPITAL_CONTRIBUTION',
  'PROFIT_ALLOCATION',
  'LOSS_ALLOCATION',
  'DISTRIBUTION',
  'WITHDRAWAL',
  'ADJUSTMENT'
);

CREATE TYPE "InvestorLedgerDirection" AS ENUM (
  'DEBIT',
  'CREDIT'
);

CREATE TABLE "Investor" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" "InvestorStatus" NOT NULL DEFAULT 'ACTIVE',
  "kycStatus" "InvestorKycStatus" NOT NULL DEFAULT 'PENDING',
  "kycVerifiedAt" TIMESTAMP(3),
  "kycReference" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorCapitalTransaction" (
  "id" SERIAL NOT NULL,
  "transactionNumber" TEXT NOT NULL,
  "investorId" INTEGER NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" "InvestorTransactionType" NOT NULL,
  "direction" "InvestorLedgerDirection" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "note" TEXT,
  "referenceType" TEXT,
  "referenceNumber" TEXT,
  "productVariantId" INTEGER,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestorCapitalTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorProductAllocation" (
  "id" SERIAL NOT NULL,
  "investorId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "participationPercent" DECIMAL(5,2),
  "committedAmount" DECIMAL(14,2),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestorProductAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Investor_code_key" ON "Investor"("code");
CREATE INDEX "Investor_name_idx" ON "Investor"("name");
CREATE INDEX "Investor_status_idx" ON "Investor"("status");
CREATE INDEX "Investor_kycStatus_idx" ON "Investor"("kycStatus");
CREATE INDEX "Investor_createdById_idx" ON "Investor"("createdById");

CREATE UNIQUE INDEX "InvestorCapitalTransaction_transactionNumber_key"
  ON "InvestorCapitalTransaction"("transactionNumber");
CREATE INDEX "InvestorCapitalTransaction_investorId_transactionDate_idx"
  ON "InvestorCapitalTransaction"("investorId", "transactionDate");
CREATE INDEX "InvestorCapitalTransaction_type_idx"
  ON "InvestorCapitalTransaction"("type");
CREATE INDEX "InvestorCapitalTransaction_direction_idx"
  ON "InvestorCapitalTransaction"("direction");
CREATE INDEX "InvestorCapitalTransaction_productVariantId_idx"
  ON "InvestorCapitalTransaction"("productVariantId");
CREATE INDEX "InvestorCapitalTransaction_createdById_idx"
  ON "InvestorCapitalTransaction"("createdById");

CREATE INDEX "InvestorProductAllocation_investorId_status_idx"
  ON "InvestorProductAllocation"("investorId", "status");
CREATE INDEX "InvestorProductAllocation_productVariantId_status_idx"
  ON "InvestorProductAllocation"("productVariantId", "status");
CREATE INDEX "InvestorProductAllocation_createdById_idx"
  ON "InvestorProductAllocation"("createdById");

ALTER TABLE "Investor"
  ADD CONSTRAINT "Investor_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorCapitalTransaction"
  ADD CONSTRAINT "InvestorCapitalTransaction_investorId_fkey"
  FOREIGN KEY ("investorId") REFERENCES "Investor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorCapitalTransaction"
  ADD CONSTRAINT "InvestorCapitalTransaction_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorCapitalTransaction"
  ADD CONSTRAINT "InvestorCapitalTransaction_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProductAllocation"
  ADD CONSTRAINT "InvestorProductAllocation_investorId_fkey"
  FOREIGN KEY ("investorId") REFERENCES "Investor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorProductAllocation"
  ADD CONSTRAINT "InvestorProductAllocation_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestorProductAllocation"
  ADD CONSTRAINT "InvestorProductAllocation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
