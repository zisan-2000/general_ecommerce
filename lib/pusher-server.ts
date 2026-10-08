import "server-only";
import Pusher from "pusher";
import {
  CHAT_ADMIN_CHANNEL, CHAT_AVAILABILITY_CHANNEL, CHAT_AVAILABILITY_EVENT,
  CHAT_CHANGED_EVENT, CHAT_TYPING_EVENT, conversationChannel,
  type ChatChange, type ChatTyping,
} from "@/lib/chat-realtime";

let pusher: Pusher | null = null;
export function getChatPusher(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID?.trim();
  const key = process.env.PUSHER_KEY?.trim();
  const secret = process.env.PUSHER_SECRET?.trim();
  const cluster = process.env.PUSHER_CLUSTER?.trim();
  // Fail closed if the browser is pointed at a different app/cluster.
  if (!appId || !key || !secret || !cluster
    || key !== process.env.NEXT_PUBLIC_PUSHER_KEY?.trim()
    || cluster !== process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim()) return null;
  pusher ??= new Pusher({ appId, key, secret, cluster, useTLS: true, timeout: 2_000 });
  return pusher;
}

async function publish(channels: string | string[], event: string, data: unknown): Promise<boolean> {
  try {
    const client = getChatPusher();
    if (!client) return false;
    await client.trigger(channels, event, data);
    return true;
  } catch {
    // SDK errors may contain signed request URLs: do not log them or return them.
    console.warn("Support chat realtime notification failed; database sync remains available.");
    return false;
  }
}

// Call only AFTER a successful database commit. Publishing must never undo a save.
export function publishChatChange(change: Omit<ChatChange, "version">) {
  return publish([conversationChannel(change.conversationId), CHAT_ADMIN_CHANNEL],
    CHAT_CHANGED_EVENT, { ...change, version: 1 });
}

export function publishChatTyping(conversationId: string, typing: ChatTyping) {
  return publish(conversationChannel(conversationId), CHAT_TYPING_EVENT, typing);
}

export function publishChatAvailability() {
  // Public invalidation only. The existing availability API is authoritative.
  return publish(CHAT_AVAILABILITY_CHANNEL, CHAT_AVAILABILITY_EVENT, { version: 1 });
}
