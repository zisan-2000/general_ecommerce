-- Presence leases only; existing chat conversations, messages and users are unchanged.
CREATE TABLE "ChatAgentPresence" (
    "id" VARCHAR(36) NOT NULL,
    "userId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatAgentPresence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatAgentPresence_isAvailable_lastHeartbeatAt_idx" ON "ChatAgentPresence"("isAvailable", "lastHeartbeatAt");
CREATE INDEX "ChatAgentPresence_userId_idx" ON "ChatAgentPresence"("userId");
ALTER TABLE "ChatAgentPresence" ADD CONSTRAINT "ChatAgentPresence_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
