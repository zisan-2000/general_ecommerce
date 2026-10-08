// Shared protocol: notifications contain IDs, never message bodies or profiles.
export const CHAT_ADMIN_CHANNEL = "private-support-chat-admin-notifications";
export const CHAT_AVAILABILITY_CHANNEL = "support-chat-availability";
export const CHAT_CHANGED_EVENT = "chat-changed";
export const CHAT_TYPING_EVENT = "chat-typing";
export const CHAT_AVAILABILITY_EVENT = "availability-changed";
export const CHAT_TYPING_TTL_MS = 6_000;
export const CHAT_AUTH_RECHECK_MS = 60_000;

export function conversationChannel(id: string) {
  return `private-support-chat-${id}`;
}

export function conversationIdFromChannel(channel: string): string | null {
  if (channel === CHAT_ADMIN_CHANNEL) return null;
  const match = /^private-support-chat-([A-Za-z0-9_-]{1,128})$/.exec(channel);
  return match?.[1] ?? null;
}

export type ChatChange = {
  version: 1;
  conversationId: string;
  kind: "created" | "message" | "updated" | "read";
  messageId?: string;
};
export type ChatTyping = {
  role: "admin" | "customer";
  participantId: string;
  typing: boolean;
};
export type ChatChannelAuthorization = { auth: string; validForMs: number };

export function isChatChange(value: unknown): value is ChatChange {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ChatChange>;
  return data.version === 1 && typeof data.conversationId === "string"
    && ["created", "message", "updated", "read"].includes(data.kind ?? "");
}

export function isChatTyping(value: unknown): value is ChatTyping {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ChatTyping>;
  return (data.role === "admin" || data.role === "customer")
    && typeof data.participantId === "string" && data.participantId.length <= 64
    && typeof data.typing === "boolean";
}

export function isChatChannelAuthorization(value: unknown): value is ChatChannelAuthorization {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ChatChannelAuthorization>;
  return typeof data.auth === "string" && Boolean(data.auth)
    && typeof data.validForMs === "number" && Number.isFinite(data.validForMs)
    && data.validForMs > 0 && data.validForMs <= CHAT_AUTH_RECHECK_MS;
}

export type ChatConnectionStatus = "connecting" | "live" | "reconnecting" | "offline" | "fallback" | "denied";
export const CHAT_CONNECTION_LABELS: Record<ChatConnectionStatus, string> = {
  connecting: "Connecting live chat…", live: "Live chat connected",
  reconnecting: "Reconnecting · periodic sync active", offline: "No network connection · draft kept",
  fallback: "Live updates unavailable · periodic sync active", denied: "Live chat access unavailable",
};
