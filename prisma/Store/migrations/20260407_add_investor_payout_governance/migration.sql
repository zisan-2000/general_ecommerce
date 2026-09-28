CREATE TYPE "InvestorProfitPayoutStatus_new" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PAID',
  'VOID'
);

ALTER TABLE "InvestorProfitPayout"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InvestorProfitPayout"
  ALTER COLUMN "status" TYPE "InvestorProfitPayoutStatus_new"
  USING (
    CASE
      WHEN "status"::TEXT = 'PAID' THEN 'PAID'
      WHEN "status"::TEXT = 'VOID' THEN 'VOID'
      ELSE 'PENDING_APPROVAL'
    END
  )::"InvestorProfitPayoutStatus_new";

DROP TYPE "InvestorProfitPayoutStatus";
ALTER TYPE "InvestorProfitPayoutStatus_new" RENAME TO "InvestorProfitPayoutStatus";

ALTER TABLE "InvestorProfitPayout"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

CREATE TYPE "InvestorPayoutPaymentMethod" AS ENUM (
  'BANK_TRANSFER',
  'MOBILE_BANKING',
  'CHEQUE',
  'CASH'
);

ALTER TABLE "InvestorProfitPayout"
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "paymentMethod" "InvestorPayoutPaymentMethod",
  ADD COLUMN "bankReference" TEXT,
  ADD COLUMN "paidById" TEXT,
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "voidReversalReference" TEXT;

CREATE INDEX "InvestorProfitPayout_approvedById_idx" ON "InvestorProfitPayout"("approvedById");
CREATE INDEX "InvestorProfitPayout_rejectedById_idx" ON "InvestorProfitPayout"("rejectedById");
CREATE INDEX "InvestorProfitPayout_paidById_idx" ON "InvestorProfitPayout"("paidById");
CREATE INDEX "InvestorProfitPayout_voidedById_idx" ON "InvestorProfitPayout"("voidedById");

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_rejectedById_fkey"
  FOREIGN KEY ("rejectedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestorProfitPayout"
  ADD CONSTRAINT "InvestorProfitPayout_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
