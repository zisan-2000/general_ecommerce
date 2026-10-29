-- Additive monitoring storage only. Do not apply without operator review.
-- A rolling ring enforces a hard maximum of 10,000 rows, independent of cleanup.
CREATE SEQUENCE "PaymentTransportEvidence_slot_seq" AS BIGINT;
CREATE TABLE "PaymentTransportEvidence" (
  "slot" INTEGER NOT NULL,
  "attemptId" VARCHAR(36) NOT NULL,
  "requestId" VARCHAR(36) NOT NULL,
  "connectionId" VARCHAR(36),
  "provider" VARCHAR(20) NOT NULL,
  "operation" VARCHAR(40) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "evidence" JSONB NOT NULL,
  CONSTRAINT "PaymentTransportEvidence_pkey" PRIMARY KEY ("slot"),
  CONSTRAINT "PaymentTransportEvidence_slot_bounded" CHECK ("slot" >= 0 AND "slot" < 10000),
  CONSTRAINT "PaymentTransportEvidence_payload_bounded" CHECK (octet_length("evidence"::text) <= 20000)
);
CREATE UNIQUE INDEX "PaymentTransportEvidence_attemptId_key" ON "PaymentTransportEvidence"("attemptId");
CREATE INDEX "PaymentTransportEvidence_requestId_startedAt_idx" ON "PaymentTransportEvidence"("requestId", "startedAt");
CREATE INDEX "PaymentTransportEvidence_expiresAt_idx" ON "PaymentTransportEvidence"("expiresAt");
