import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { chatJson, rejectUnsafeChatMutation } from "@/lib/chat-guest-session";
import { getRealtimeChatActor, requireRealtimeConversation } from "@/lib/chat-realtime-access";
import { publishChatTyping } from "@/lib/pusher-server";
import { rateLimitRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unsafe = rejectUnsafeChatMutation(request);
    if (unsafe) return unsafe;
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.typing !== "boolean") return chatJson({ error: "Invalid typing request." }, { status: 400 });
    const context = await getRealtimeChatActor(request);
    const rejected = await requireRealtimeConversation(id, context);
    if (rejected) return rejected;
    const identity = context.actor.userId ?? `guest:${context.guestSession!.conversationId}`;
    const rate = await rateLimitRequest(request, {
      scope: "support-chat-typing", limit: 40, windowMs: 60_000, identifier: `${id}:${identity}`,
    });
    if (!rate.allowed) return chatJson({ error: "Please wait." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const published = await publishChatTyping(id, {
      role: context.actor.isAdmin ? "admin" : "customer",
      participantId: createHash("sha256").update(`${id}:${identity}`).digest("hex").slice(0, 24),
      typing: body.typing,
    });
    return chatJson({ published }, { status: published ? 200 : 503 });
  } catch {
    return chatJson({ error: "Typing status unavailable." }, { status: 503 });
  }
}
