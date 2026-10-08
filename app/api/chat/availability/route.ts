import { chatJson } from "@/lib/chat-guest-session";
import { chatPresenceFailureCode, getChatAvailability } from "@/lib/chat-agent-presence";
import { logChatAvailability } from "@/lib/chat-availability-diagnostics";

export async function GET() {
  try {
    return chatJson(await getChatAvailability());
  } catch (error) {
    const code = chatPresenceFailureCode(error);
    logChatAvailability("availability-api-failed", { reason: code, httpStatus: 503 });
    // Unknown is not Offline, and certainly must not fall back to hardcoded Online.
    return chatJson({ error: "Support availability could not be checked.", code }, { status: 503 });
  }
}
