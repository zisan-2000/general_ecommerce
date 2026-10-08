import "server-only";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { publishChatAvailability } from "@/lib/pusher-server";
import { logChatAvailability } from "@/lib/chat-availability-diagnostics";
import {
  CHAT_AGENT_IDLE_MS,
  CHAT_AGENT_LEASE_MS,
  type AgentPresenceAction,
  type AgentPresenceReason,
  type AgentPresenceResponse,
  type AgentPresenceTrigger,
  type ChatAvailability,
} from "@/lib/chat-availability";

type PresenceRow = {
  id: string;
  userId: string;
  isAvailable: boolean;
  revision: number;
  lastHeartbeatAt: Date;
  lastActivityAt: Date;
  serverNow: Date;
  databaseTimeZone: string;
};

function validClock(row: PresenceRow, now: number): boolean {
  const heartbeat = row.lastHeartbeatAt.getTime();
  const activity = row.lastActivityAt.getTime();
  return Number.isFinite(now) && Number.isFinite(heartbeat) && Number.isFinite(activity)
    && heartbeat <= now && activity <= heartbeat;
}

function remainingLease(row: PresenceRow, now: number): number {
  // Do not turn legacy timezone-shifted, future-dated rows into a fresh lease.
  return row.isAvailable && validClock(row, now) ? Math.max(0, Math.min(
    CHAT_AGENT_LEASE_MS,
    row.lastHeartbeatAt.getTime() + CHAT_AGENT_LEASE_MS - now,
    row.lastActivityAt.getTime() + CHAT_AGENT_IDLE_MS - now,
  )) : 0;
}

// Known schema errors only; never return query text, connection details or IDs.
export function chatPresenceFailureCode(error: unknown): "CHAT_PRESENCE_SCHEMA_UNAVAILABLE" | "CHAT_PRESENCE_UNAVAILABLE" {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2021" || error.code === "P2022") return "CHAT_PRESENCE_SCHEMA_UNAVAILABLE";
    if (error.code === "P2010" && "meta" in error && error.meta && typeof error.meta === "object"
      && "code" in error.meta && (error.meta.code === "42P01" || error.meta.code === "42703")) {
      return "CHAT_PRESENCE_SCHEMA_UNAVAILABLE";
    }
  }
  return "CHAT_PRESENCE_UNAVAILABLE";
}

function presenceReason(row: PresenceRow, now: number, revision: number): AgentPresenceReason {
  if (row.revision === 2147483647) return "REVOKED";
  if (!row.isAvailable) return "AWAY";
  if (!validClock(row, now)) return "LEASE_EXPIRED";
  if (now >= row.lastActivityAt.getTime() + CHAT_AGENT_IDLE_MS) return "IDLE_EXPIRED";
  if (now >= row.lastHeartbeatAt.getTime() + CHAT_AGENT_LEASE_MS) return "LEASE_EXPIRED";
  return row.revision !== revision ? "STALE_REVISION" : "AVAILABLE";
}

export async function updateAgentPresence(input: {
  userId: string;
  id: string;
  revision: number;
  action: AgentPresenceAction;
  idleSeconds: number;
  trigger?: AgentPresenceTrigger;
}): Promise<AgentPresenceResponse | null> {
  const requestedAvailable = input.action !== "away" && input.idleSeconds * 1000 < CHAT_AGENT_IDLE_MS;

  if (input.action === "available") {
    // Retire this agent's legacy future-dated leases on explicit opt-in. Merely
    // excluding them from a read is insufficient: they could appear fresh again
    // hours later when UTC catches up. Keep terminal tombstones for replay safety;
    // the new workspace is inserted below with a correct UTC timestamp.
    await prisma.$executeRaw`
      UPDATE "ChatAgentPresence" SET "isAvailable" = FALSE, "revision" = 2147483647,
        "updatedAt" = (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
      WHERE "userId" = ${input.userId} AND "isAvailable" = TRUE
        AND ("lastHeartbeatAt" > (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
          OR "lastActivityAt" > "lastHeartbeatAt")
    `;
    // Bounded retention of this agent's ephemeral workspace records, not chat
    // history. Keep tombstones for 24 hours to reject delayed/replayed controls.
    await prisma.$executeRaw`
      DELETE FROM "ChatAgentPresence" WHERE "userId" = ${input.userId}
        AND "updatedAt" < (statement_timestamp() AT TIME ZONE 'UTC') - INTERVAL '24 hours'
    `;
  }

  // Tagged parameters only. A tombstone is created for Away even if its earlier
  // Available request is delayed. Revisions prevent that late request reviving it.
  // Raw SQL avoids depending on a generated delegate before the migration ships.
  // Timestamp(3) has no timezone. Generate and compare UTC timestamps inside
  // PostgreSQL, avoiding Date/timestamptz coercion through the session timezone.
  // Use that same DB clock for reads/TTL, not a different app server's wall clock.
  const readStartedAt = performance.now();
  const rows = await prisma.$queryRaw<PresenceRow[]>`
    WITH clock AS (
      SELECT (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS now
    )
    INSERT INTO "ChatAgentPresence"
      ("id", "userId", "isAvailable", "revision", "lastHeartbeatAt", "lastActivityAt", "updatedAt")
    SELECT ${input.id}, ${input.userId}, ${input.action === "available" && requestedAvailable}, ${input.revision},
      clock.now, clock.now - ${input.idleSeconds}::double precision * INTERVAL '1 second', clock.now
    FROM clock WHERE TRUE
    ON CONFLICT ("id") DO UPDATE SET
      "isAvailable" = ${requestedAvailable}, "revision" = EXCLUDED."revision",
      "lastHeartbeatAt" = EXCLUDED."lastHeartbeatAt",
      "lastActivityAt" = EXCLUDED."lastActivityAt", "updatedAt" = EXCLUDED."updatedAt"
    WHERE "ChatAgentPresence"."userId" = EXCLUDED."userId"
      AND "ChatAgentPresence"."revision" < EXCLUDED."revision"
      AND (${input.action !== "heartbeat"} OR (
        "ChatAgentPresence"."isAvailable" = TRUE
        AND "ChatAgentPresence"."lastHeartbeatAt" <= EXCLUDED."lastHeartbeatAt"
        AND "ChatAgentPresence"."lastActivityAt" <= "ChatAgentPresence"."lastHeartbeatAt"
        AND "ChatAgentPresence"."lastHeartbeatAt" > EXCLUDED."lastHeartbeatAt" - ${CHAT_AGENT_LEASE_MS}::double precision * INTERVAL '1 millisecond'
        AND "ChatAgentPresence"."lastActivityAt" > EXCLUDED."lastHeartbeatAt" - ${CHAT_AGENT_IDLE_MS}::double precision * INTERVAL '1 millisecond'))
    RETURNING "id", "userId", "isAvailable", "revision", "lastHeartbeatAt", "lastActivityAt",
      (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS "serverNow",
      current_setting('TimeZone') AS "databaseTimeZone"
  `;
  const row = rows[0] ?? (await prisma.$queryRaw<PresenceRow[]>`
    SELECT "id", "userId", "isAvailable", "revision", "lastHeartbeatAt", "lastActivityAt",
      (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS "serverNow",
      current_setting('TimeZone') AS "databaseTimeZone"
    FROM "ChatAgentPresence" WHERE "id" = ${input.id} AND "userId" = ${input.userId}
  `)[0];
  if (!row) return null;
  // An expired/revoked workspace can reject a heartbeat even when the client
  // requested Available. Notify customers of the resulting state, not intent.
  const observedNow = () => row.serverNow.getTime() + Math.max(0, performance.now() - readStartedAt);
  if (input.action !== "heartbeat" || remainingLease(row, observedNow()) === 0) await publishChatAvailability();
  // Subtract query/publish elapsed time conservatively; waiting cannot extend TTL.
  const responseAt = observedNow();
  const availableForMs = remainingLease(row, responseAt);
  const result: AgentPresenceResponse = {
    available: availableForMs > 0, revision: row.revision, availableForMs,
    reason: presenceReason(row, responseAt, input.revision),
  };
  logChatAvailability("presence-write-result", {
    workspaceId: input.id, trigger: input.trigger ?? "legacy-client", writeApplied: rows.length > 0,
    action: input.action, revision: input.revision, serverRevision: row.revision,
    idleSeconds: input.idleSeconds, available: result.available, availableForMs,
    presenceReason: result.reason,
    serverNow: new Date(responseAt).toISOString(), databaseTimeZone: row.databaseTimeZone,
    clockValid: validClock(row, responseAt),
    heartbeatExpiresAt: new Date(row.lastHeartbeatAt.getTime() + CHAT_AGENT_LEASE_MS).toISOString(),
    idleExpiresAt: new Date(row.lastActivityAt.getTime() + CHAT_AGENT_IDLE_MS).toISOString(),
  });
  return result;
}

export async function getChatAvailability(): Promise<ChatAvailability> {
  const readStartedAt = performance.now();
  const candidates = await prisma.$queryRaw<PresenceRow[]>`
    WITH clock AS (
      SELECT (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS now
    )
    SELECT p."id", p."userId", p."isAvailable", p."revision", p."lastHeartbeatAt", p."lastActivityAt",
      clock.now AS "serverNow", current_setting('TimeZone') AS "databaseTimeZone"
    FROM "ChatAgentPresence" p INNER JOIN "User" u ON u."id" = p."userId"
    CROSS JOIN clock
    WHERE p."isAvailable" = TRUE AND u."banned" IS DISTINCT FROM TRUE
      AND p."lastHeartbeatAt" <= clock.now
      AND p."lastActivityAt" <= p."lastHeartbeatAt"
      AND p."lastHeartbeatAt" > clock.now - ${CHAT_AGENT_LEASE_MS}::double precision * INTERVAL '1 millisecond'
      AND p."lastActivityAt" > clock.now - ${CHAT_AGENT_IDLE_MS}::double precision * INTERVAL '1 millisecond'
  `;
  // Recheck live permissions: deleting a role or revoking chats.manage must not
  // leave an otherwise fresh heartbeat advertised as an available support agent.
  const userIds = [...new Set(candidates.map((row) => row.userId))];
  const permissions = new Map(await Promise.all(userIds.map(async (id) => {
    const access = await getAccessContext({ id });
    return [id, access.has("chats.manage")] as const;
  })));
  const elapsedMs = Math.max(0, performance.now() - readStartedAt);
  const availableForMs = candidates.reduce((remaining, row) => permissions.get(row.userId)
    ? Math.max(remaining, remainingLease(row, row.serverNow.getTime() + elapsedMs)) : remaining, 0);
  // Do not expose names, emails, user IDs, workspace IDs or individual activity.
  const result: ChatAvailability = { status: availableForMs > 0 ? "AVAILABLE" : "UNAVAILABLE", availableForMs };
  logChatAvailability("availability-api-result", {
    ...result, candidateCount: candidates.length,
    permittedAgentCount: [...permissions.values()].filter(Boolean).length,
  });
  return result;
}

export async function revokeAgentPresence(userId: string): Promise<void> {
  // Terminal revision also invalidates requests already in flight during logout.
  await prisma.$executeRaw`
    UPDATE "ChatAgentPresence" SET "isAvailable" = FALSE, "revision" = 2147483647,
      "updatedAt" = (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3) WHERE "userId" = ${userId}
  `;
  logChatAvailability("presence-revoked", { reason: "logout", available: false });
  await publishChatAvailability();
}
