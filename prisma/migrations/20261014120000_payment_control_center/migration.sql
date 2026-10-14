-- Additive only. No changes to existing money, status or inventory records.
-- Apply after backup and staging review; never run concurrently with another migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE "PaymentEvent" (
 "id" TEXT NOT NULL, "requestId" VARCHAR(36), "paymentId" INTEGER, "orderId" INTEGER, "transactionId" VARCHAR(50),
 "provider" VARCHAR(20) NOT NULL, "operation" VARCHAR(40) NOT NULL, "outcome" VARCHAR(40) NOT NULL,
 "httpStatus" INTEGER, "durationMs" INTEGER, "gatewayStatus" VARCHAR(40), "detailCode" VARCHAR(60),
 "actorUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PaymentEvent_duration_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
 CONSTRAINT "PaymentEvent_http_check" CHECK ("httpStatus" IS NULL OR "httpStatus" BETWEEN 100 AND 599)
);
CREATE TABLE "PaymentReconciliation" (
 "id" TEXT NOT NULL, "paymentId" INTEGER NOT NULL, "databaseStatus" VARCHAR(20) NOT NULL,
 "orderStatus" VARCHAR(20) NOT NULL, "gatewayStatus" VARCHAR(40) NOT NULL, "result" VARCHAR(40) NOT NULL,
 "amountMatches" BOOLEAN, "referenceMatches" BOOLEAN, "actorUserId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentDispute" (
 "id" TEXT NOT NULL, "paymentId" INTEGER NOT NULL, "idempotencyKey" VARCHAR(80) NOT NULL,
 "category" VARCHAR(30) NOT NULL, "complaint" VARCHAR(2000) NOT NULL,
 "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN', "assignedToId" TEXT, "createdById" TEXT NOT NULL,
 "resolution" VARCHAR(2000), "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PaymentDispute_status_check" CHECK ("status" IN ('OPEN','INVESTIGATING','RESOLVED','REJECTED')),
 CONSTRAINT "PaymentDispute_category_check" CHECK ("category" IN ('COMPLAINT','PAYMENT_MISMATCH','REFUND','DUPLICATE_CHARGE')),
 CONSTRAINT "PaymentDispute_version_check" CHECK ("version" > 0)
);
CREATE TABLE "PaymentDisputeEvidence" (
 "id" TEXT NOT NULL, "disputeId" TEXT NOT NULL, "label" VARCHAR(120) NOT NULL,
 "note" VARCHAR(2000) NOT NULL, "url" VARCHAR(1000), "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentDisputeEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentDisputeActivity" (
 "id" TEXT NOT NULL, "disputeId" TEXT NOT NULL, "action" VARCHAR(30) NOT NULL,
 "fromStatus" VARCHAR(20), "toStatus" VARCHAR(20) NOT NULL, "assignedToId" TEXT, "resolution" VARCHAR(2000), "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentDisputeActivity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentSandboxRun" (
 "id" TEXT NOT NULL, "idempotencyKey" VARCHAR(80) NOT NULL, "provider" VARCHAR(20) NOT NULL,
 "scenario" VARCHAR(30) NOT NULL, "result" JSONB NOT NULL, "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentSandboxRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payment_provider_createdAt_id_idx" ON "Payment"("provider","createdAt","id");
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId","status");
CREATE INDEX "PaymentEvent_paymentId_createdAt_id_idx" ON "PaymentEvent"("paymentId","createdAt","id");
CREATE INDEX "PaymentEvent_transactionId_createdAt_idx" ON "PaymentEvent"("transactionId","createdAt");
CREATE INDEX "PaymentEvent_provider_operation_createdAt_idx" ON "PaymentEvent"("provider","operation","createdAt");
CREATE INDEX "PaymentEvent_requestId_idx" ON "PaymentEvent"("requestId");
CREATE INDEX "PaymentReconciliation_paymentId_createdAt_id_idx" ON "PaymentReconciliation"("paymentId","createdAt","id");
CREATE INDEX "PaymentReconciliation_result_createdAt_idx" ON "PaymentReconciliation"("result","createdAt");
CREATE UNIQUE INDEX "PaymentDispute_idempotencyKey_key" ON "PaymentDispute"("idempotencyKey");
CREATE INDEX "PaymentDispute_paymentId_createdAt_idx" ON "PaymentDispute"("paymentId","createdAt");
CREATE INDEX "PaymentDispute_status_assignedToId_updatedAt_idx" ON "PaymentDispute"("status","assignedToId","updatedAt");
CREATE INDEX "PaymentDisputeEvidence_disputeId_createdAt_idx" ON "PaymentDisputeEvidence"("disputeId","createdAt");
CREATE INDEX "PaymentDisputeActivity_disputeId_createdAt_idx" ON "PaymentDisputeActivity"("disputeId","createdAt");
CREATE UNIQUE INDEX "PaymentSandboxRun_idempotencyKey_key" ON "PaymentSandboxRun"("idempotencyKey");
CREATE INDEX "PaymentSandboxRun_createdAt_idx" ON "PaymentSandboxRun"("createdAt");
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentDisputeEvidence" ADD CONSTRAINT "PaymentDisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDisputeActivity" ADD CONSTRAINT "PaymentDisputeActivity_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
