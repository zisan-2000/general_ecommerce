import "server-only";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { getChatActor, canAccessConversation } from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { chatJson, readGuestChatSession, rejectUnownedGuestChat } from "@/lib/chat-guest-session";

export async function getRealtimeChatActor(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(session?.user);
  const actor = getChatActor(session?.user, { canManageChats: access.has("chats.manage") });
  const guestSession = actor.userId ? null : await readGuestChatSession(request);
  const expiresAt = actor.userId
    ? (session?.expires ? new Date(session.expires).getTime() : 0)
    : (guestSession?.expiresAt ?? 0) * 1000;
  return { actor, guestSession, expiresAt };
}

export async function requireRealtimeConversation(
  id: string, context: Awaited<ReturnType<typeof getRealtimeChatActor>>,
): Promise<Response | null> {
  const unowned = rejectUnownedGuestChat(context.actor, context.guestSession, id);
  if (unowned) return unowned;
  const conversation = await prisma.chatConversation.findUnique({
    where: { id }, select: { id: true, userId: true },
  });
  if (!conversation) return chatJson({ error: "Chat unavailable." }, { status: 404 });
  if (!canAccessConversation(conversation, context.actor, context.guestSession)) {
    return chatJson({ error: "Chat access unavailable." }, { status: 403 });
  }
  return null;
}
