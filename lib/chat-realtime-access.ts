import "server-only";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { getChatActor, canAccessConversation } from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { chatJson, readGuestChatSession, rejectUnownedGuestChat } from "@/lib/chat-guest-session";

async function getVerifiedLoginExpiry(request: NextRequest, userId: string): Promise<number> {
  // This project explicitly uses JWT sessions despite having a Prisma adapter.
  // Do not silently interpret a database session token as a JWT if that changes.
  if (authOptions.session?.strategy !== "jwt") {
    throw new Error("Realtime chat session strategy is not configured for JWT verification.");
  }
  const secret = authOptions.jwt?.secret ?? authOptions.secret
    ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("Realtime chat JWT verification secret is not configured.");

  // getToken handles cookie chunking and authenticated JWT decryption/verification.
  // Only examine the login cookie used by getServerSession, not a Bearer fallback.
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  const token = await getToken({
    req: new NextRequest(request.url, { headers }),
    secret,
    cookieName: authOptions.cookies?.sessionToken?.name,
    secureCookie: authOptions.useSecureCookies,
    decode: authOptions.jwt?.decode,
  });
  if (!token || token.id !== userId || typeof token.exp !== "number"
    || !Number.isSafeInteger(token.exp) || token.exp * 1000 <= Date.now()) return 0;
  return token.exp * 1000;
}

export async function getRealtimeChatActor(request: NextRequest) {
  // Keep NextAuth callbacks: banned/deleted-user checks and live RBAC remain intact.
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(session?.user);
  const actor = getChatActor(session?.user, { canManageChats: access.has("chats.manage") });
  const guestSession = actor.userId ? null : await readGuestChatSession(request);
  // getServerSession(authOptions) strips session.expires in the installed v4
  // App Router path. Read the original verified cookie's exp, never invent a TTL.
  const expiresAt = actor.userId
    ? await getVerifiedLoginExpiry(request, actor.userId)
    : (guestSession?.expiresAt ?? 0) * 1000;
  return { actor, guestSession, expiresAt };
}

export function rejectInvalidRealtimeLogin(context: Awaited<ReturnType<typeof getRealtimeChatActor>>): Response | null {
  if (context.actor.userId && (!Number.isFinite(context.expiresAt) || context.expiresAt <= Date.now())) {
    return chatJson({ error: "Login session is invalid or expired.", code: "CHAT_LOGIN_SESSION_INVALID" }, { status: 401 });
  }
  return null;
}

export async function requireRealtimeConversation(
  id: string, context: Awaited<ReturnType<typeof getRealtimeChatActor>>,
): Promise<Response | null> {
  const invalidLogin = rejectInvalidRealtimeLogin(context);
  if (invalidLogin) return invalidLogin;
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
