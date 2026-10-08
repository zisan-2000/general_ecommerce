import "server-only";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { publishChatAvailability } from "@/lib/pusher-server";
import {
  CHAT_AGENT_IDLE_MS,
  CHAT_AGENT_LEASE_MS,
  type AgentPresenceAction,
  type AgentPresenceResponse,
  type ChatAvailability,
} from "@/lib/chat-availability";

type PresenceRow = {
  id: string;
  userId: string;
  isAvailable: boolean;
  revision: number;
  lastHeartbeatAt: Date;
  lastActivityAt: Date;
};

function remainingLease(row: PresenceRow, now: number): number {
  return row.isAvailable ? Math.max(0, Math.min(
    row.lastHeartbeatAt.getTime() + CHAT_AGENT_LEASE_MS - now,
    row.lastActivityAt.getTime() + CHAT_AGENT_IDLE_MS - now,
  )) : 0;
}

export async function updateAgentPresence(input: {
  userId: string;
  id: string;
  revision: number;
  action: AgentPresenceAction;
  idleSeconds: number;
}): Promise<AgentPresenceResponse | null> {
  const now = new Date();
  const heartbeatCutoff = new Date(now.getTime() - CHAT_AGENT_LEASE_MS);
  const activityCutoff = new Date(now.getTime() - CHAT_AGENT_IDLE_MS);
  const lastActivityAt = new Date(now.getTime() - input.idleSeconds * 1000);
  const requestedAvailable = input.action !== "away" && input.idleSeconds * 1000 < CHAT_AGENT_IDLE_MS;

  if (input.action === "available") {
    // Bounded retention of this agent's ephemeral workspace records, not chat
    // history. Keep tombstones for 24 hours to reject delayed/replayed controls.
    await prisma.$executeRaw`
      DELETE FROM "ChatAgentPresence" WHERE "userId" = ${input.userId}
        AND "updatedAt" < ${new Date(now.getTime() - 24 * 60 * 60_000)}
    `;
  }

  // Tagged parameters only. A tombstone is created for Away even if its earlier
  // Available request is delayed. Revisions prevent that late request reviving it.
  // Raw SQL avoids depending on a generated delegate before the migration ships.
  const rows = await prisma.$queryRaw<PresenceRow[]>`
    INSERT INTO "ChatAgentPresence"
      ("id", "userId", "isAvailable", "revision", "lastHeartbeatAt", "lastActivityAt", "updatedAt")
    VALUES (${input.id}, ${input.userId}, ${input.action === "available"}, ${input.revision},
      ${now}, ${lastActivityAt}, ${now})
    ON CONFLICT ("id") DO UPDATE SET
      "isAvailable" = ${requestedAvailable}, "revision" = EXCLUDED."revision",
      "lastHeartbeatAt" = EXCLUDED."lastHeartbeatAt",
      "lastActivityAt" = EXCLUDED."lastActivityAt", "updatedAt" = EXCLUDED."updatedAt"
    WHERE "ChatAgentPresence"."userId" = EXCLUDED."userId"
      AND "ChatAgentPresence"."revision" < EXCLUDED."revision"
      AND (${input.action !== "heartbeat"} OR (
        "ChatAgentPresence"."isAvailable" = TRUE
        AND "ChatAgentPresence"."lastHeartbeatAt" > ${heartbeatCutoff}
        AND "ChatAgentPresence"."lastActivityAt" > ${activityCutoff}))
    RETURNING "id", "userId", "isAvailable", "revision", "lastHeartbeatAt", "lastActivityAt"
  `;
  const row = rows[0] ?? (await prisma.$queryRaw<PresenceRow[]>`
    SELECT "id", "userId", "isAvailable", "revision", "lastHeartbeatAt", "lastActivityAt"
    FROM "ChatAgentPresence" WHERE "id" = ${input.id} AND "userId" = ${input.userId}
  `)[0];
  if (!row) return null;
  if (input.action !== "heartbeat" || !requestedAvailable) await publishChatAvailability();
  return { available: remainingLease(row, Date.now()) > 0, revision: row.revision };
}

export async function getChatAvailability(): Promise<ChatAvailability> {
  const now = Date.now();
  const candidates = await prisma.$queryRaw<PresenceRow[]>`
    SELECT p."id", p."userId", p."isAvailable", p."revision", p."lastHeartbeatAt", p."lastActivityAt"
    FROM "ChatAgentPresence" p INNER JOIN "User" u ON u."id" = p."userId"
    WHERE p."isAvailable" = TRUE AND u."banned" IS DISTINCT FROM TRUE
      AND p."lastHeartbeatAt" > ${new Date(now - CHAT_AGENT_LEASE_MS)}
      AND p."lastActivityAt" > ${new Date(now - CHAT_AGENT_IDLE_MS)}
  `;
  // Recheck live permissions: deleting a role or revoking chats.manage must not
  // leave an otherwise fresh heartbeat advertised as an available support agent.
  const userIds = [...new Set(candidates.map((row) => row.userId))];
  const permissions = new Map(await Promise.all(userIds.map(async (id) => {
    const access = await getAccessContext({ id });
    return [id, access.has("chats.manage")] as const;
  })));
  const availableForMs = candidates.reduce((remaining, row) => permissions.get(row.userId)
    ? Math.max(remaining, remainingLease(row, Date.now())) : remaining, 0);
  // Do not expose names, emails, user IDs, workspace IDs or individual activity.
  return { status: availableForMs > 0 ? "AVAILABLE" : "UNAVAILABLE", availableForMs };
}

export async function revokeAgentPresence(userId: string): Promise<void> {
  // Terminal revision also invalidates requests already in flight during logout.
  await prisma.$executeRaw`
    UPDATE "ChatAgentPresence" SET "isAvailable" = FALSE, "revision" = 2147483647,
      "updatedAt" = ${new Date()} WHERE "userId" = ${userId}
  `;
  await publishChatAvailability();
}
