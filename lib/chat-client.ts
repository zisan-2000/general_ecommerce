// Browser-safe chat transport. Never display arbitrary API/error strings to customers.
export type ChatConversation = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH";
  guestEmail?: string | null;
  guestName?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderRole: string;
  message: string;
  attachmentUrl?: string | null;
  createdAt: string;
};

export type ChatErrorKind = "network" | "timeout" | "server" | "validation"
  | "authentication" | "forbidden" | "not-found" | "rate-limit" | "unexpected";
export type ChatOperation = "read" | "start" | "send" | "close";
export type ChatUiError = {
  kind: ChatErrorKind;
  operation: ChatOperation;
  title: string;
  message: string;
  retryable: boolean;
};

const KNOWN_CODES = [
  "GUEST_CHAT_SESSION_REQUIRED", "MESSAGE_TOO_LONG", "MESSAGE_EMPTY",
  "INVALID_MESSAGE_ID", "MESSAGE_ID_CONFLICT",
] as const;
type ChatErrorCode = typeof KNOWN_CODES[number];

export class ChatRequestError extends Error {
  constructor(
    readonly kind: ChatErrorKind,
    readonly status?: number,
    readonly code?: ChatErrorCode,
    readonly fields?: { guestName: boolean; guestEmail: boolean },
  ) {
    super("Chat request failed.");
    this.name = "ChatRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isChatConversation(value: unknown): value is ChatConversation {
  return isRecord(value) && typeof value.id === "string" && Boolean(value.id)
    && typeof value.status === "string" && ["OPEN", "IN_PROGRESS", "CLOSED"].includes(value.status)
    && typeof value.priority === "string" && ["LOW", "NORMAL", "HIGH"].includes(value.priority)
    && typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && typeof value.id === "string" && Boolean(value.id)
    && typeof value.conversationId === "string" && Boolean(value.conversationId)
    && typeof value.senderRole === "string" && typeof value.message === "string"
    && typeof value.createdAt === "string";
}

export function createChatMessageId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  // getRandomValues also works in local, non-HTTPS development contexts.
  // Never fall back to predictable Math.random() IDs.
  if (!globalThis.crypto?.getRandomValues) throw new ChatRequestError("unexpected");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isChatConversationList(value: unknown): value is ChatConversation[] {
  return Array.isArray(value) && value.every(isChatConversation);
}

export type ChatMessagesResponse = { conversation: ChatConversation; messages: ChatMessage[] };
export function isChatMessagesResponse(value: unknown): value is ChatMessagesResponse {
  return isRecord(value) && isChatConversation(value.conversation)
    && Array.isArray(value.messages) && value.messages.every(isChatMessage);
}

function responseError(status: number, payload: unknown): ChatRequestError {
  const kind: ChatErrorKind = status === 401 ? "authentication"
    : status === 403 ? "forbidden" : status === 404 ? "not-found"
    : status === 408 || status === 504 ? "timeout" : status === 429 ? "rate-limit"
    : status >= 500 ? "server" : [400, 409, 413, 415, 422].includes(status) ? "validation"
    : "unexpected";
  const code = isRecord(payload) && KNOWN_CODES.some((known) => known === payload.code)
    ? payload.code as ChatErrorCode : undefined;
  const fieldErrors = isRecord(payload) && isRecord(payload.fieldErrors) ? payload.fieldErrors : null;
  return new ChatRequestError(kind, status, code, fieldErrors ? {
    guestName: Object.prototype.hasOwnProperty.call(fieldErrors, "guestName"),
    guestEmail: Object.prototype.hasOwnProperty.call(fieldErrors, "guestEmail"),
  } : undefined);
}

export async function fetchChatJson<T>(
  url: string,
  init?: RequestInit,
  validate?: (payload: unknown) => payload is T,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (timedOut) throw new ChatRequestError("timeout");
      if (!response.ok) throw responseError(response.status, null);
      throw new ChatRequestError(error instanceof SyntaxError ? "unexpected" : "network");
    }
    if (timedOut) throw new ChatRequestError("timeout");
    if (!response.ok) throw responseError(response.status, payload);
    if (validate && !validate(payload)) throw new ChatRequestError("unexpected");
    return payload as T;
  } catch (error) {
    if (error instanceof ChatRequestError) throw error;
    throw new ChatRequestError(timedOut ? "timeout" : "network");
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", abort);
  }
}

export function describeChatError(
  error: unknown,
  operation: ChatOperation,
  guest: boolean,
  messageSent = false,
): ChatUiError {
  const failure = error instanceof ChatRequestError ? error : new ChatRequestError("unexpected");
  const titles: Record<ChatErrorKind, string> = {
    network: "Connection problem", timeout: "Request timed out", server: "Support service unavailable",
    validation: "Please check your information", authentication: "Chat session expired",
    forbidden: "Chat access unavailable", "not-found": "Chat unavailable",
    "rate-limit": "Please wait a moment", unexpected: "Unable to complete chat request",
  };
  const reasons: Record<ChatErrorKind, string> = {
    network: "Check your internet connection and try again.",
    timeout: "The support service took too long to respond. Please try again.",
    server: "The support service is having a problem. Please try again shortly.",
    validation: "Please check the information you entered before trying again.",
    authentication: guest
      ? "Start a new chat using the form below. Email alone cannot restore previous chats."
      : "Please sign in again to continue chatting.",
    forbidden: "This chat cannot be accessed with your current session. Reopen support or start a new chat.",
    "not-found": "This conversation is no longer available. Please reopen support.",
    "rate-limit": "Too many requests were sent. Wait a moment before trying again.",
    unexpected: "We could not read the support service response. Please try again.",
  };
  if (failure.code === "MESSAGE_TOO_LONG") reasons.validation = "Messages must not exceed 4,000 characters.";
  if (failure.code === "MESSAGE_EMPTY") reasons.validation = "Enter a message before sending.";
  if (failure.code === "MESSAGE_ID_CONFLICT") {
    reasons.validation = "This retry does not match the original message. Refresh the chat before sending again.";
  }
  const actions: Record<ChatOperation, string> = {
    read: messageSent ? "Your message was sent, but we could not refresh the chat." : "We could not refresh the chat.",
    start: "We could not start your chat.",
    send: "We could not confirm that your message was sent. Your text has been kept.",
    close: "We could not confirm the chat update. Your feedback has been kept; refresh the chat to check.",
  };
  return {
    kind: failure.kind,
    operation,
    title: titles[failure.kind],
    message: `${actions[operation]} ${reasons[failure.kind]}`,
    retryable: ["network", "timeout", "server", "rate-limit", "unexpected"].includes(failure.kind),
  };
}
