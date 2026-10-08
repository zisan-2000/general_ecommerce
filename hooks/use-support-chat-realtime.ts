"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Pusher from "pusher-js";
import {
  ChatRequestError, fetchChatJson,
} from "@/lib/chat-client";
import {
  CHAT_ADMIN_CHANNEL, CHAT_AVAILABILITY_CHANNEL, CHAT_AVAILABILITY_EVENT,
  CHAT_CHANGED_EVENT, CHAT_TYPING_EVENT, CHAT_TYPING_TTL_MS, conversationChannel,
  isChatChange, isChatTyping, isChatChannelAuthorization,
  type ChatChannelAuthorization, type ChatConnectionStatus,
} from "@/lib/chat-realtime";

type Options = {
  enabled: boolean;
  identity: string;
  conversationId: string | null;
  admin?: boolean;
  availability?: boolean;
  onSynchronize: () => Promise<boolean | void>;
  onAvailability?: () => void;
  onAccessError: (error: ChatRequestError) => void;
};

export function useSupportChatRealtime(options: Options) {
  const { enabled, identity, conversationId, admin = false, availability = false } = options;
  const callbacks = useRef(options);
  useEffect(() => { callbacks.current = options; });
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>("connecting");
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingAction = useRef<(typing: boolean) => void>(() => {});
  const synchronizeAction = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let denied = false;
    let busy = false;
    let dirty = false;
    let failures = 0;
    let live = false;
    let pusher: Pusher | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let ownTypingTimer: ReturnType<typeof setTimeout> | undefined;
    let lastTypingAt = 0;
    let wasTyping = false;
    const renewals = new Map<string, ReturnType<typeof setTimeout>>();
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const authControllers = new Set<AbortController>();
    const channels = [
      ...(admin ? [CHAT_ADMIN_CHANNEL] : []),
      ...(conversationId ? [conversationChannel(conversationId)] : []),
      ...(availability ? [CHAT_AVAILABILITY_CHANNEL] : []),
    ];

    const active = () => !disposed && !denied && document.visibilityState === "visible" && navigator.onLine;
    const clearTyping = () => {
      for (const typingTimer of typingTimers.values()) clearTimeout(typingTimer);
      typingTimers.clear();
      if (!disposed) setRemoteTyping(false);
    };
    const planSync = () => {
      // Repeated SDK reconnect/auth failures must not postpone this deadline.
      if (disposed || denied || timer !== undefined) return;
      // Low-frequency reconciliation also recovers a committed save whose publish failed.
      const delay = Math.min(120_000, (live ? 60_000 : 30_000) * 2 ** Math.min(failures, 2));
      timer = setTimeout(() => { timer = undefined; requestSync(); }, delay);
    };
    const synchronize = async () => {
      if (!active()) { planSync(); return; }
      if (busy) { dirty = true; return; }
      clearTimeout(timer);
      timer = undefined;
      busy = true;
      dirty = false;
      try {
        const success = await callbacks.current.onSynchronize();
        if (!disposed) failures = success === false ? failures + 1 : 0;
      } catch {
        if (!disposed) failures += 1;
      } finally {
        busy = false;
        if (!disposed) {
          if (dirty && active()) requestSync();
          else planSync();
        }
      }
    };
    const requestSync = () => {
      if (disposed || denied) return;
      if (busy) { dirty = true; return; }
      if (debounce !== undefined) return;
      debounce = setTimeout(() => { debounce = undefined; void synchronize(); }, 100);
    };
    synchronizeAction.current = requestSync;

    const accessFailure = (error: ChatRequestError) => {
      denied = true;
      live = false;
      clearTimeout(timer);
      clearTimeout(debounce);
      for (const renewal of renewals.values()) clearTimeout(renewal);
      renewals.clear();
      pusher?.disconnect();
      clearTyping();
      setConnectionStatus("denied");
      callbacks.current.onAccessError(error);
    };

    const subscribe = (name: string) => {
      if (!pusher || disposed || denied) return;
      const channel = pusher.subscribe(name);
      channel.bind("pusher:subscription_succeeded", () => {
        if (disposed || denied) return;
        // Public availability alone does not imply private chat authorization.
        const authorized = channels.filter((item) => item.startsWith("private-"))
          .every((item) => pusher?.channel(item)?.subscribed);
        live = authorized;
        setConnectionStatus(authorized ? "live" : "connecting");
        requestSync();
        callbacks.current.onAvailability?.();
      });
      channel.bind("pusher:subscription_error", () => {
        if (disposed || denied) return;
        live = false;
        setConnectionStatus("fallback");
        planSync();
        // Pusher does not automatically retry every failed auth request.
        clearTimeout(renewals.get(name));
        renewals.set(name, setTimeout(() => renew(name), 30_000));
      });
      channel.bind(CHAT_CHANGED_EVENT, (payload: unknown) => {
        if (!isChatChange(payload)) return;
        if (name !== CHAT_ADMIN_CHANNEL && payload.conversationId !== conversationId) return;
        requestSync();
      });
      channel.bind(CHAT_AVAILABILITY_EVENT, () => {
        if (active()) callbacks.current.onAvailability?.();
      });
      channel.bind(CHAT_TYPING_EVENT, (payload: unknown) => {
        if (!active() || !isChatTyping(payload) || payload.role === (admin ? "admin" : "customer")) return;
        clearTimeout(typingTimers.get(payload.participantId));
        typingTimers.delete(payload.participantId);
        if (payload.typing) {
          typingTimers.set(payload.participantId, setTimeout(() => {
            typingTimers.delete(payload.participantId);
            if (!disposed) setRemoteTyping(typingTimers.size > 0);
          }, CHAT_TYPING_TTL_MS));
        }
        setRemoteTyping(typingTimers.size > 0);
      });
    };
    const renew = (name: string) => {
      if (!active() || !pusher) return;
      pusher.channel(name)?.unbind_all();
      pusher.unsubscribe(name);
      subscribe(name);
    };

    const publishTyping = (typing: boolean) => {
      if (!conversationId || !active() || !live) return;
      const now = performance.now();
      if (typing && now - lastTypingAt < 3_000) return;
      if (!typing && !wasTyping) return;
      lastTypingAt = now;
      wasTyping = typing;
      // Ephemeral/optional; a failure must not replace a message error or lose a draft.
      void fetchChatJson(`/api/chat/conversations/${encodeURIComponent(conversationId)}/typing`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing }),
      }).catch(() => {});
    };
    typingAction.current = (typing) => {
      clearTimeout(ownTypingTimer);
      publishTyping(typing);
      if (typing) ownTypingTimer = setTimeout(() => publishTyping(false), 3_500);
    };

    const setup = async () => {
      const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim();
      const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim();
      if (!key || !cluster) {
        setConnectionStatus(navigator.onLine ? "fallback" : "offline");
        planSync();
        return;
      }
      try {
        const { default: PusherClient } = await import("pusher-js");
        if (disposed) return;
        pusher = new PusherClient(key, {
          cluster, forceTLS: true,
          channelAuthorization: {
            customHandler: (params, callback) => {
              const controller = new AbortController();
              authControllers.add(controller);
              const startedAt = performance.now();
              void fetchChatJson<ChatChannelAuthorization>("/api/chat/realtime/auth", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params), signal: controller.signal,
              }, isChatChannelAuthorization).then((authorization) => {
                if (disposed || denied || !pusher || pusher.connection.socket_id !== params.socketId
                  || pusher.connection.state !== "connected") return;
                // This is a CLIENT reauthorization interval, not a provider-enforced token TTL.
                const remaining = authorization.validForMs - (performance.now() - startedAt);
                if (remaining <= 0) throw new ChatRequestError("authentication", 401);
                clearTimeout(renewals.get(params.channelName));
                renewals.set(params.channelName, setTimeout(() => renew(params.channelName),
                  Math.max(250, remaining - Math.min(5_000, remaining / 2))));
                callback(null, { auth: authorization.auth });
              }).catch((error: unknown) => {
                if (disposed || denied || pusher?.connection.socket_id !== params.socketId) return;
                const failure = error instanceof ChatRequestError ? error : new ChatRequestError("unexpected");
                if ([401, 403, 404].includes(failure.status ?? 0)) accessFailure(failure);
                else { live = false; setConnectionStatus("fallback"); planSync(); }
                callback(failure, null);
              }).finally(() => authControllers.delete(controller));
            },
          },
        });
        pusher.connection.bind("state_change", ({ current }: { current: string }) => {
          if (disposed || denied) return;
          if (current === "connected") { requestSync(); return; }
          live = false;
          for (const renewal of renewals.values()) clearTimeout(renewal);
          renewals.clear();
          clearTyping();
          setConnectionStatus(!navigator.onLine ? "offline" : current === "connecting" ? "connecting" : "reconnecting");
          planSync();
        });
        channels.forEach(subscribe);
        if (document.visibilityState !== "visible" || !navigator.onLine) pusher.disconnect();
      } catch {
        if (!disposed) { live = false; setConnectionStatus("fallback"); planSync(); }
      }
    };
    const visibility = () => {
      if (disposed || denied) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        publishTyping(false);
        live = false;
        clearTyping();
        pusher?.disconnect();
        setConnectionStatus(navigator.onLine ? "reconnecting" : "offline");
      } else {
        // Reconnect obtains fresh private authorization and always reconciles DB state.
        pusher?.connect();
        requestSync();
        callbacks.current.onAvailability?.();
      }
    };
    setRemoteTyping(false);
    setConnectionStatus(navigator.onLine ? "connecting" : "offline");
    void setup();
    planSync();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", visibility);
    window.addEventListener("offline", visibility);
    window.addEventListener("focus", visibility);
    return () => {
      publishTyping(false);
      disposed = true;
      typingAction.current = () => {};
      synchronizeAction.current = () => {};
      clearTimeout(timer);
      clearTimeout(debounce);
      clearTimeout(ownTypingTimer);
      for (const renewal of renewals.values()) clearTimeout(renewal);
      for (const typingTimer of typingTimers.values()) clearTimeout(typingTimer);
      authControllers.forEach((controller) => controller.abort());
      channels.forEach((name) => pusher?.channel(name)?.unbind_all());
      pusher?.connection.unbind_all();
      pusher?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", visibility);
      window.removeEventListener("offline", visibility);
      window.removeEventListener("focus", visibility);
    };
  }, [enabled, identity, conversationId, admin, availability]);

  const notifyTyping = useCallback((typing: boolean) => typingAction.current(typing), []);
  const requestSynchronize = useCallback(() => synchronizeAction.current(), []);
  return { connectionStatus, remoteTyping, notifyTyping, requestSynchronize };
}
