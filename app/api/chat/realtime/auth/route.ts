import type { NextRequest } from "next/server";
import { chatJson, rejectUnsafeChatMutation } from "@/lib/chat-guest-session";
import { getRealtimeChatActor, rejectInvalidRealtimeLogin, requireRealtimeConversation } from "@/lib/chat-realtime-access";
import { CHAT_ADMIN_CHANNEL, CHAT_AUTH_RECHECK_MS, conversationIdFromChannel } from "@/lib/chat-realtime";
import { getChatPusher } from "@/lib/pusher-server";
import { rateLimitRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const unsafe = rejectUnsafeChatMutation(request);
    if (unsafe) return unsafe;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.socketId !== "string" || !/^\d{1,20}\.\d{1,20}$/.test(body.socketId)
      || typeof body.channelName !== "string") {
      return chatJson({ error: "Invalid channel request." }, { status: 400 });
    }
    const isAdminChannel = body.channelName === CHAT_ADMIN_CHANNEL;
    const id = conversationIdFromChannel(body.channelName);
    if (!isAdminChannel && !id) return chatJson({ error: "Channel not permitted." }, { status: 403 });
    const context = await getRealtimeChatActor(request);
    const invalidLogin = rejectInvalidRealtimeLogin(context);
    if (invalidLogin) return invalidLogin;
    if (isAdminChannel && !context.actor.userId) {
      return chatJson({ error: "A valid login session is required.", code: "CHAT_LOGIN_SESSION_INVALID" }, { status: 401 });
    }
    if (!context.actor.userId && !context.guestSession) {
      return chatJson({ error: "A valid guest chat session is required.", code: "GUEST_CHAT_SESSION_REQUIRED" }, { status: 401 });
    }
    const rate = await rateLimitRequest(request, {
      scope: "support-chat-channel-auth", limit: 120, windowMs: 60_000,
      identifier: context.actor.userId ?? `guest:${context.guestSession!.conversationId}`,
    });
    if (!rate.allowed) return chatJson({ error: "Please wait." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    if (isAdminChannel) {
      if (!context.actor.userId || !context.actor.isAdmin) {
        return chatJson({ error: "Channel not permitted." }, { status: 403 });
      }
    } else {
      const rejected = await requireRealtimeConversation(id!, context);
      if (rejected) return rejected;
    }
    const validForMs = Math.min(CHAT_AUTH_RECHECK_MS, context.expiresAt - Date.now());
    if (!Number.isFinite(validForMs) || validForMs <= 0) {
      return chatJson({ error: "Chat session expired.", code: context.actor.userId
        ? "CHAT_LOGIN_SESSION_INVALID" : "GUEST_CHAT_SESSION_REQUIRED" }, { status: 401 });
    }
    const pusher = getChatPusher();
    if (!pusher) return chatJson({ error: "Live chat is not configured." }, { status: 503 });
    return chatJson({ ...pusher.authorizeChannel(body.socketId, body.channelName), validForMs });
  } catch {
    return chatJson({ error: "Live chat authorization unavailable." }, { status: 503 });
  }
}
