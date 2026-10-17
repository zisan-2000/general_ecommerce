-- Complete schema fields already used by the application but absent from release history.
-- No changes to payment behavior, payment records, orders, refunds or inventory data.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'ORDER_UPDATE';

ALTER TABLE "Order"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3);

CREATE TYPE "RefundPayoutStatus" AS ENUM ('PENDING', 'PAID');

ALTER TABLE "Refund"
  ADD COLUMN "adminNote" TEXT,
  ADD COLUMN "refundMethod" TEXT NOT NULL DEFAULT 'Original payment method',
  ADD COLUMN "refundAccount" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "payoutStatus" "RefundPayoutStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "payoutTransactionId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "paidById" TEXT;

CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");
CREATE INDEX "Refund_reviewedById_idx" ON "Refund"("reviewedById");
CREATE INDEX "Refund_paidById_idx" ON "Refund"("paidById");
CREATE INDEX "Refund_payoutStatus_createdAt_idx" ON "Refund"("payoutStatus", "createdAt");

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
