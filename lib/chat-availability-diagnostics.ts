import type { AgentPresenceAction, AgentPresenceReason, AgentPresenceTrigger, ChatAvailability } from "@/lib/chat-availability";

// Browser/server safe, development only. Never pass error objects, API bodies,
// profiles, user IDs, channel auth, cookies or environment values here. Workspace
// UUIDs are correlation IDs only: access still requires the owner login + RBAC.
type DiagnosticDetails = {
  workspaceId?: string;
  trigger?: AgentPresenceTrigger;
  action?: AgentPresenceAction;
  reason?: string;
  revision?: number;
  serverRevision?: number;
  available?: boolean;
  status?: ChatAvailability["status"];
  presenceReason?: AgentPresenceReason;
  availableForMs?: number;
  idleSeconds?: number;
  heartbeatExpiresAt?: string;
  idleExpiresAt?: string;
  serverNow?: string;
  databaseTimeZone?: string;
  clockValid?: boolean;
  writeApplied?: boolean;
  httpStatus?: number;
  errorKind?: string;
  candidateCount?: number;
  permittedAgentCount?: number;
  published?: boolean;
  visibility?: DocumentVisibilityState;
};

export function logChatAvailability(event: string, details: DiagnosticDetails = {}): void {
  if (process.env.NODE_ENV !== "development") return;
  const { workspaceId, ...safeDetails } = details;
  const correlation = workspaceId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(workspaceId)
    ? { workspaceId } : {};
  console.info("[Support availability]", { event, at: new Date().toISOString(), ...safeDetails, ...correlation });
}
