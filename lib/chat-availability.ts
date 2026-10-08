// Shared, browser-safe policy. Heartbeats do not establish availability on login.
export const CHAT_AGENT_HEARTBEAT_MS = 25_000;
export const CHAT_AGENT_LEASE_MS = 90_000;
export const CHAT_AGENT_IDLE_MS = 5 * 60_000;
export const CHAT_AVAILABILITY_POLL_MS = 20_000;

export type ChatAvailability = {
  status: "AVAILABLE" | "UNAVAILABLE";
  availableForMs: number;
};

export type AgentPresenceResponse = { available: boolean; revision: number };
export type AgentPresenceAction = "available" | "away" | "heartbeat";

export function isChatAvailability(value: unknown): value is ChatAvailability {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (data.status === "AVAILABLE" || data.status === "UNAVAILABLE")
    && typeof data.availableForMs === "number" && Number.isFinite(data.availableForMs)
    && data.availableForMs >= 0 && data.availableForMs <= CHAT_AGENT_LEASE_MS
    && (data.status === "AVAILABLE" ? data.availableForMs > 0 : data.availableForMs === 0);
}

export function isAgentPresenceResponse(value: unknown): value is AgentPresenceResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.available === "boolean" && typeof data.revision === "number"
    && Number.isInteger(data.revision) && data.revision >= 1;
}
