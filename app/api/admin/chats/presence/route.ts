import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { chatJson, rejectUnsafeChatMutation } from "@/lib/chat-guest-session";
import { updateAgentPresence } from "@/lib/chat-agent-presence";

export async function POST(request: NextRequest) {
  try {
    const unsafe = rejectUnsafeChatMutation(request);
    if (unsafe) return unsafe;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return chatJson({ error: "Unauthorized." }, { status: 401 });
    const access = await getAccessContext(session.user);
    if (!access.has("chats.manage")) return chatJson({ error: "Forbidden." }, { status: 403 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return chatJson({ error: "Invalid presence request." }, { status: 400 });
    }
    const { id, revision, action, idleSeconds = 0 } = body as Record<string, unknown>;
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
      || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || revision >= 2147483647
      || (action !== "available" && action !== "away" && action !== "heartbeat")
      || typeof idleSeconds !== "number" || !Number.isInteger(idleSeconds) || idleSeconds < 0 || idleSeconds > 300) {
      return chatJson({ error: "Invalid presence request." }, { status: 400 });
    }
    const result = await updateAgentPresence({ userId: session.user.id, id, revision, action, idleSeconds });
    if (!result) return chatJson({ error: "Presence workspace unavailable." }, { status: 409 });
    return chatJson(result);
  } catch (error) {
    console.error("CHAT AGENT PRESENCE POST ERROR:", error);
    return chatJson({ error: "Support status could not be updated." }, { status: 503 });
  }
}
