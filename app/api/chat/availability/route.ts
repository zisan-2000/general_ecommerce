import { chatJson } from "@/lib/chat-guest-session";
import { getChatAvailability } from "@/lib/chat-agent-presence";

export async function GET() {
  try {
    return chatJson(await getChatAvailability());
  } catch (error) {
    console.error("CHAT AVAILABILITY GET ERROR:", error);
    // Unknown is not Offline, and certainly must not fall back to hardcoded Online.
    return chatJson({ error: "Support availability could not be checked." }, { status: 503 });
  }
}
