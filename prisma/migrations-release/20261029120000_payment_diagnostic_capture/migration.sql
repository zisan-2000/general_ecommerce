BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE "PaymentDiagnosticCapture" (
  "id" VARCHAR(36) PRIMARY KEY,
  "paymentId" INTEGER NOT NULL,
  "requestId" VARCHAR(36),
  "provider" VARCHAR(20) NOT NULL,
  "operation" VARCHAR(40) NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  "agentId" VARCHAR(64) NOT NULL,
  "createdById" TEXT NOT NULL,
  "seconds" INTEGER NOT NULL,
  "maxBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "errorCode" VARCHAR(60),
  "packetCount" INTEGER,
  "bytes" INTEGER,
  "sha256" VARCHAR(64),
  "summary" JSONB,
  CONSTRAINT "PaymentDiagnosticCapture_limits" CHECK ("seconds" BETWEEN 1 AND 60 AND "maxBytes" BETWEEN 65536 AND 2097152),
  CONSTRAINT "PaymentDiagnosticCapture_scope" CHECK ("provider" IN ('EPS', 'AIBL_WALLET') AND "operation" IN ('AUTH', 'INITIALIZE', 'STATUS_QUERY', 'VERIFY') AND "kind" IN ('READINESS', 'CAPTURE')),
  CONSTRAINT "PaymentDiagnosticCapture_state" CHECK ("status" IN ('QUEUED', 'RUNNING', 'UPLOADING', 'COMPLETE', 'FAILED'))
);
CREATE INDEX "PaymentDiagnosticCapture_agentId_status_createdAt_idx" ON "PaymentDiagnosticCapture"("agentId", "status", "createdAt");
CREATE INDEX "PaymentDiagnosticCapture_paymentId_createdAt_idx" ON "PaymentDiagnosticCapture"("paymentId", "createdAt");
CREATE INDEX "PaymentDiagnosticCapture_expiresAt_idx" ON "PaymentDiagnosticCapture"("expiresAt");
COMMIT;
