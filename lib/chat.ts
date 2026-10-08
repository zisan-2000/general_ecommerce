import type { ChatConversation } from "@/generated/prisma";
import type { VerifiedGuestChatSession } from "@/lib/chat-guest-session";

type SessionUser = {
  id?: string;
  role?: string;
} | null | undefined;

type ConversationAccessShape = Pick<ChatConversation, "id" | "userId">;

export type ChatActor = {
  userId: string | null;
  role: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  senderRole: "admin" | "user" | "guest";
};

export function normalizeGuestEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 3 ? normalized : null;
}

export function getChatActor(
  sessionUser: SessionUser,
  options?: { canManageChats?: boolean },
): ChatActor {
  const userId = typeof sessionUser?.id === "string" ? sessionUser.id : null;
  const role = typeof sessionUser?.role === "string" ? sessionUser.role : null;
  const isAdmin =
    options?.canManageChats ?? (role?.toLowerCase() === "admin");

  return {
    userId,
    role,
    isAdmin,
    isAuthenticated: Boolean(userId),
    senderRole: isAdmin ? "admin" : userId ? "user" : "guest",
  };
}

export function canAccessConversation(
  conversation: ConversationAccessShape,
  actor: ChatActor,
  guestSession: VerifiedGuestChatSession | null,
): boolean {
  if (actor.isAdmin) return true;
  if (actor.userId) return conversation.userId === actor.userId;
  return conversation.userId === null
    && guestSession !== null
    && guestSession.conversationId === conversation.id
    && guestSession.expiresAt > Math.floor(Date.now() / 1000);
}
