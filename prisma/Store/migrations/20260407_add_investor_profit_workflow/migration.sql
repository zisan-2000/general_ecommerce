ALTER TABLE "InvestorProfitRun"
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "postedById" TEXT,
  ADD COLUMN "postedAt" TIMESTAMP(3),
  ADD COLUMN "postingNote" TEXT;

CREATE TYPE "InvestorProfitRunStatus_new" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'POSTED'
);

ALTER TABLE "InvestorProfitRun"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InvestorProfitRun"
  ALTER COLUMN "status" TYPE "InvestorProfitRunStatus_new"
  USING (
    CASE
      WHEN "status"::TEXT = 'COMPLETED' THEN 'APPROVED'
      ELSE 'PENDING_APPROVAL'
    END
  )::"InvestorProfitRunStatus_new";

DROP TYPE "InvestorProfitRunStatus";
ALTER TYPE "InvestorProfitRunStatus_new" RENAME TO "InvestorProfitRunStatus";

ALTER TABLE "InvestorProfitRun"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

CREATE TYPE "InvestorProfitPayoutStatus" AS ENUM (
  'PAID',
  'VOID'
);

CREATE TABLE "InvestorProfitPayout" (
  "id" SERIAL NOT NULL,
  "payoutNumber" TEXT NOT NULL,
  "runId" INTEGER NOT NULL,
  "investorId" INTEGER NOT NULL,
  "transactionId" INTEGER,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "payoutPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "holdbackPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "grossProfitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "holdbackAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "payoutAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "InvestorProfitPayoutStatus" NOT NULL DEFAULT 'PAID',
  "note" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestorProfitPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestorProfitPayout_payoutNumber_key" ON "InvestorProfitPayout"("payoutNumber");
CREATE UNIQUE INDEX "InvestorProfitPayout_transactionId_key" ON "InvestorProfitPayout"("transactionId");
CREATE INDEX "InvestorProfitPayout_runId_investorId_idx" ON "InvestorProfitPayout"("runId", "investorId");
CREATE INDEX "InvestorProfitPayout_status_paidAt_idx" ON "InvestorProfitPayout"("status", "paidAt");
CREATE INDEX "InvestorProfitPayout_createdById_idx" ON "InvestorProfitPayout"("createdById");

CREATE INDEX "InvestorProfitRun_status_idx" ON "InvestorProfitRun"("status");
CREATE INDEX "InvestorProfitRun_approvedById_idx" ON "InvestorProfitRun"("approvedById");
CREATE INDEX "InvestorProfitRun_postedById_idx" ON "InvestorProfitRun"("postedById");

ALTER TABLE "InvestorProfitRun"
  ADD CONSTRAINT "InvestorProfitRun_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitRun"
  ADD CONSTRAINT "InvestorProfitRun_postedById_fkey"
  FOREIGN KEY ("postedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "InvestorProfitRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_investorId_fkey"
  FOREIGN KEY ("investorId") REFERENCES "Investor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "InvestorCapitalTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
