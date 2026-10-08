import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { chatJson, rejectUnsafeChatMutation } from "@/lib/chat-guest-session";
import { chatPresenceFailureCode, updateAgentPresence } from "@/lib/chat-agent-presence";
import { logChatAvailability } from "@/lib/chat-availability-diagnostics";
import { isAgentPresenceTrigger } from "@/lib/chat-availability";

export async function POST(request: NextRequest) {
  let requestDetails: Parameters<typeof logChatAvailability>[1] = {};
  try {
    const unsafe = rejectUnsafeChatMutation(request);
    if (unsafe) {
      logChatAvailability("presence-request-rejected", { reason: "unsafe-request", httpStatus: unsafe.status });
      return unsafe;
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logChatAvailability("presence-request-rejected", { reason: "authentication", httpStatus: 401 });
      return chatJson({ error: "Unauthorized." }, { status: 401 });
    }
    const access = await getAccessContext(session.user);
    if (!access.has("chats.manage")) {
      logChatAvailability("presence-request-rejected", { reason: "permission", httpStatus: 403 });
      return chatJson({ error: "Forbidden." }, { status: 403 });
    }
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      logChatAvailability("presence-request-rejected", { reason: "invalid-body", httpStatus: 400 });
      return chatJson({ error: "Invalid presence request." }, { status: 400 });
    }
    const { id, revision, action, idleSeconds = 0, trigger = "legacy-client" } = body as Record<string, unknown>;
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
      || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || revision >= 2147483647
      || (action !== "available" && action !== "away" && action !== "heartbeat")
      || typeof idleSeconds !== "number" || !Number.isInteger(idleSeconds) || idleSeconds < 0 || idleSeconds > 300
      || !isAgentPresenceTrigger(trigger)) {
      logChatAvailability("presence-request-rejected", { reason: "invalid-fields", httpStatus: 400 });
      return chatJson({ error: "Invalid presence request." }, { status: 400 });
    }
    requestDetails = { workspaceId: id, revision, action, trigger, idleSeconds };
    logChatAvailability("presence-api-request", requestDetails);
    const result = await updateAgentPresence({ userId: session.user.id, id, revision, action, idleSeconds, trigger });
    if (!result) {
      logChatAvailability("presence-request-rejected", { ...requestDetails, reason: "workspace-unavailable", httpStatus: 409 });
      return chatJson({ error: "Presence workspace unavailable." }, { status: 409 });
    }
    logChatAvailability("presence-api-response", {
      ...requestDetails, httpStatus: 200, serverRevision: result.revision,
      available: result.available, availableForMs: result.availableForMs, presenceReason: result.reason,
    });
    return chatJson(result);
  } catch (error) {
    const code = chatPresenceFailureCode(error);
    logChatAvailability("presence-api-failed", { ...requestDetails, reason: code, httpStatus: 503 });
    return chatJson({ error: "Support status could not be updated.", code }, { status: 503 });
  }
}
