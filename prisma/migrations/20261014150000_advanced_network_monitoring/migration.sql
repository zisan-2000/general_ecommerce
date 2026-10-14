-- Additive measured diagnostics. Does not update money, inventory or case records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "PaymentEvent" ADD COLUMN "networkAgentId" VARCHAR(64), ADD COLUMN "requestStartedAt" TIMESTAMP(3), ADD COLUMN "requestCompletedAt" TIMESTAMP(3);
CREATE INDEX "PaymentEvent_networkAgentId_createdAt_idx" ON "PaymentEvent"("networkAgentId","createdAt");
CREATE TABLE "NetworkMonitorAgent" (
 "id" VARCHAR(64) PRIMARY KEY, "label" VARCHAR(100) NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
 "createdById" TEXT NOT NULL, "lastObservedAt" TIMESTAMP(3), "lastSeenAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "NetworkProbeTarget" (
 "id" TEXT PRIMARY KEY, "agentId" VARCHAR(64) NOT NULL, "label" VARCHAR(100) NOT NULL,
 "address" VARCHAR(45) NOT NULL, "protocol" VARCHAR(10) NOT NULL, "port" INTEGER,
 "intervalSeconds" INTEGER NOT NULL DEFAULT 60, "timeoutMs" INTEGER NOT NULL DEFAULT 3000,
 "enabled" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 1,
 "approvedById" TEXT NOT NULL, "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "NetworkProbeTarget_limits" CHECK ("intervalSeconds" >= 60 AND "timeoutMs" BETWEEN 100 AND 5000 AND "version" > 0),
 CONSTRAINT "NetworkProbeTarget_protocol" CHECK (("protocol" = 'TCP' AND "port" IS NOT NULL AND "port" BETWEEN 1 AND 65535) OR ("protocol" = 'ICMP' AND "port" IS NULL)),
 CONSTRAINT "NetworkProbeTarget_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "NetworkMonitorAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "NetworkProbeTarget_agentId_enabled_idx" ON "NetworkProbeTarget"("agentId","enabled");
CREATE TABLE "NetworkHostSample" (
 "id" TEXT PRIMARY KEY, "agentId" VARCHAR(64) NOT NULL, "sessionId" VARCHAR(36) NOT NULL, "sequence" INTEGER NOT NULL,
 "adapterKey" VARCHAR(64), "observedAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "intervalStartAt" TIMESTAMP(3), "counterState" VARCHAR(20) NOT NULL,
 "packetsSent" BIGINT, "packetsReceived" BIGINT, "packetsDropped" BIGINT, "tcpRetransmissions" BIGINT, "tcpConnectionFailures" BIGINT,
 "sentDelta" BIGINT, "receivedDelta" BIGINT, "droppedDelta" BIGINT, "retransmissionsDelta" BIGINT, "connectionFailuresDelta" BIGINT,
 CONSTRAINT "NetworkHostSample_sequence_check" CHECK ("sequence" > 0),
 CONSTRAINT "NetworkHostSample_nonnegative" CHECK (
   ("packetsSent" IS NULL OR "packetsSent" >= 0) AND ("packetsReceived" IS NULL OR "packetsReceived" >= 0) AND
   ("packetsDropped" IS NULL OR "packetsDropped" >= 0) AND ("tcpRetransmissions" IS NULL OR "tcpRetransmissions" >= 0) AND
   ("tcpConnectionFailures" IS NULL OR "tcpConnectionFailures" >= 0) AND ("sentDelta" IS NULL OR "sentDelta" >= 0) AND
   ("receivedDelta" IS NULL OR "receivedDelta" >= 0) AND ("droppedDelta" IS NULL OR "droppedDelta" >= 0) AND
   ("retransmissionsDelta" IS NULL OR "retransmissionsDelta" >= 0) AND ("connectionFailuresDelta" IS NULL OR "connectionFailuresDelta" >= 0)),
 CONSTRAINT "NetworkHostSample_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "NetworkMonitorAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NetworkHostSample_agentId_sessionId_sequence_key" ON "NetworkHostSample"("agentId","sessionId","sequence");
CREATE INDEX "NetworkHostSample_agentId_observedAt_id_idx" ON "NetworkHostSample"("agentId","observedAt","id");
CREATE TABLE "NetworkProbeSample" (
 "id" TEXT PRIMARY KEY, "sampleId" TEXT NOT NULL, "targetId" TEXT NOT NULL, "targetVersion" INTEGER NOT NULL,
 "targetLabel" VARCHAR(100) NOT NULL, "address" VARCHAR(45) NOT NULL, "protocol" VARCHAR(10) NOT NULL, "port" INTEGER,
 "startedAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3) NOT NULL, "outcome" VARCHAR(20) NOT NULL,
 "latencyMs" DOUBLE PRECISION, "elapsedMs" DOUBLE PRECISION NOT NULL, "errorCode" VARCHAR(40),
 CONSTRAINT "NetworkProbeSample_outcome_check" CHECK ("outcome" IN ('SUCCESS','TIMEOUT','UNREACHABLE','ERROR')),
 CONSTRAINT "NetworkProbeSample_time_check" CHECK ("completedAt" >= "startedAt" AND "elapsedMs" >= 0 AND ("latencyMs" IS NULL OR "latencyMs" >= 0)),
 CONSTRAINT "NetworkProbeSample_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "NetworkHostSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "NetworkProbeSample_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "NetworkProbeTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NetworkProbeSample_sampleId_targetId_key" ON "NetworkProbeSample"("sampleId","targetId");
CREATE INDEX "NetworkProbeSample_targetId_completedAt_id_idx" ON "NetworkProbeSample"("targetId","completedAt","id");
CREATE TABLE "NetworkMonitorAlert" (
 "id" TEXT PRIMARY KEY, "dedupeKey" VARCHAR(200) NOT NULL, "scope" VARCHAR(20) NOT NULL,
 "agentId" VARCHAR(64), "targetId" TEXT, "requestId" VARCHAR(36), "code" VARCHAR(40) NOT NULL,
 "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN', "value" DOUBLE PRECISION, "threshold" DOUBLE PRECISION,
 "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "resolvedAt" TIMESTAMP(3), "occurrences" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "NetworkMonitorAlert_scope_check" CHECK ("scope" IN ('HOST','PROBE','PAYMENT_API')),
 CONSTRAINT "NetworkMonitorAlert_status_check" CHECK ("status" IN ('OPEN','RESOLVED'))
);
CREATE UNIQUE INDEX "NetworkMonitorAlert_dedupeKey_key" ON "NetworkMonitorAlert"("dedupeKey");
CREATE INDEX "NetworkMonitorAlert_agentId_status_lastSeenAt_idx" ON "NetworkMonitorAlert"("agentId","status","lastSeenAt");
CREATE INDEX "NetworkMonitorAlert_scope_status_idx" ON "NetworkMonitorAlert"("scope","status");
COMMIT;
