"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useSupportChatRealtime } from "@/hooks/use-support-chat-realtime";
import { CHAT_CONNECTION_LABELS } from "@/lib/chat-realtime";
import { AlertCircle, LoaderCircle, MessageCircle, RotateCcw, Send, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAT_AVAILABILITY_POLL_MS, type ChatAvailability, isChatAvailability } from "@/lib/chat-availability";
import { logChatAvailability } from "@/lib/chat-availability-diagnostics";
import {
  type ChatConversation,
  type ChatMessage,
  type ChatOperation,
  type ChatUiError,
  ChatRequestError,
  createChatMessageId,
  describeChatError,
  fetchChatJson,
  isChatConversation,
  isChatConversationList,
  isChatMessage,
  mergeChatMessages,
  synchronizeChatMessages,
} from "@/lib/chat-client";
import {
  type GuestChatProfile,
  type GuestChatProfileErrors,
  validateGuestChatProfile,
} from "@/lib/chat-guest-profile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type SenderRole = "admin" | "user" | "guest" | string;

type PendingChatMessage = {
  clientMessageId: string;
  conversationId: string | null;
  message: string;
  quickAction: string;
  orderReference: string;
  originalDraft: string;
};

const QUICK_ACTIONS = [
  "Track Order",
  "Return / Refund",
  "Payment Issue",
  "Talk to Agent",
];

const LS_GUEST_NAME = "support_chat_guest_name";
const LS_GUEST_EMAIL = "support_chat_guest_email";
const LS_CONVERSATION_ID = "support_chat_conversation_id";

function getRoleForSession(
  role: string | undefined,
  permissions: string[] | undefined,
): SenderRole {
  if (Array.isArray(permissions) && permissions.includes("chats.manage")) {
    return "admin";
  }
  if (role?.toLowerCase() === "admin") return "admin";
  return role ? "user" : "guest";
}

function formatChatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SupportChatWidget() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [open, setOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState<ChatAvailability["status"] | "CHECKING" | "UNKNOWN">("CHECKING");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [guestFieldErrors, setGuestFieldErrors] = useState<GuestChatProfileErrors>({});
  const [resolvedIdentity, setResolvedIdentity] = useState<string | null>(null);
  const [readError, setReadError] = useState<ChatUiError | null>(null);
  const [actionError, setActionError] = useState<ChatUiError | null>(null);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [feedback, setFeedback] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const guestNameInputRef = useRef<HTMLInputElement | null>(null);
  const guestEmailInputRef = useRef<HTMLInputElement | null>(null);
  const guestFormRef = useRef<HTMLFormElement | null>(null);
  const mutationEpochRef = useRef<number | null>(null);
  const pendingMessageRef = useRef<PendingChatMessage | null>(null);
  const messageReadSequenceRef = useRef(0);
  const messageReadRef = useRef<{
    epoch: number;
    conversationId: string;
    sequence: number;
    promise: Promise<boolean>;
  } | null>(null);
  const startRequestEpochRef = useRef<number | null>(null);
  const hydrationRequestRef = useRef(0);
  const requestEpochRef = useRef(0);
  const messageDataRef = useRef<{ conversationId: string; messages: ChatMessage[] } | null>(null);
  const refreshAvailabilityRef = useRef<() => void>(() => {});
  const [messageOwner, setMessageOwner] = useState<string | null>(null);
  const identity = status === "loading"
    ? "loading"
    : session?.user?.id ? `user:${session.user.id}` : "guest";
  const resolvingConversation = status === "loading" || !hydrated
    || resolvedIdentity !== identity || (loading && !conversation);
  const showGuestForm = !resolvingConversation && !session?.user?.id && !conversation;
  const role = getRoleForSession(
    (session?.user as { role?: string } | undefined)?.role,
    (session?.user as { permissions?: string[] } | undefined)?.permissions,
  );
  const shouldRender = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith("/admin")) return false;
    if (pathname.startsWith("/signin")) return false;
    if (pathname.startsWith("/sign-up")) return false;
    if (pathname.startsWith("/forgot-password")) return false;
    if (pathname.startsWith("/reset-password")) return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setGuestName(localStorage.getItem(LS_GUEST_NAME) || "");
      setGuestEmail(localStorage.getItem(LS_GUEST_EMAIL) || "");
      // A legacy ID is not proof of ownership. Only the server's cookie can resume.
      localStorage.removeItem(LS_CONVERSATION_ID);
    } catch {
      // Chat sessions still work if localStorage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Drop stale requests and private messages on login/logout/account switching.
    requestEpochRef.current += 1;
    setConversation(null);
    setMessages([]);
    setMessageOwner(null);
    setResolvedIdentity(null);
    setGuestFieldErrors({});
    startRequestEpochRef.current = null;
    mutationEpochRef.current = null;
    pendingMessageRef.current = null;
    messageReadSequenceRef.current += 1;
    messageReadRef.current = null;
    messageDataRef.current = null;
    setReadError(null);
    setActionError(null);
    setLoading(false);
    setSending(false);
    setStarting(false);
    setClosing(false);
    setRefreshing(false);
    setDraftMessage("");
    setShowFeedback(false);
    setFeedback("");
    return () => { requestEpochRef.current += 1; };
  }, [identity]);

  const handleChatError = useCallback(
    (fetchError: unknown, operation: ChatOperation, messageSent = false) => {
      const nextError = describeChatError(fetchError, operation, !session?.user?.id, messageSent);
      if (["authentication", "forbidden", "not-found"].includes(nextError.kind)) {
        // A response that started before access was revoked must not repopulate
        // this private thread after its channel/API authorization fails.
        requestEpochRef.current += 1;
        mutationEpochRef.current = null;
        startRequestEpochRef.current = null;
        setLoading(false);
        setStarting(false);
        setSending(false);
        setClosing(false);
        setConversation(null);
        setMessages([]);
        setMessageOwner(null);
        messageReadSequenceRef.current += 1;
        messageReadRef.current = null;
        messageDataRef.current = null;
        setRefreshing(false);
        setResolvedIdentity(session?.user?.id ? null : identity);
        if (operation === "read" && pendingMessageRef.current) {
          setActionError(describeChatError(fetchError, "send", !session?.user?.id));
        }
      }
      if (operation === "read") setReadError(nextError);
      else setActionError(nextError);
    },
    [identity, session?.user?.id],
  );

  const loadMessages = useCallback(
    (conversationId: string, silent = true, messageSent = false): Promise<boolean> => {
      const epoch = requestEpochRef.current;
      if (!silent) setRefreshing(true);
      const activeRead = messageReadRef.current;
      if (activeRead?.epoch === epoch && activeRead.conversationId === conversationId) return activeRead.promise;
      const sequence = ++messageReadSequenceRef.current;
      const promise = (async () => {
        try {
          const isCurrent = () => epoch === requestEpochRef.current && sequence === messageReadSequenceRef.current;
          const current = messageDataRef.current?.conversationId === conversationId
            ? messageDataRef.current.messages : [];
          const data = await synchronizeChatMessages(
            conversationId, current,
            (page) => {
              const previous = messageDataRef.current?.conversationId === conversationId
                ? messageDataRef.current.messages : [];
              messageDataRef.current = { conversationId, messages: mergeChatMessages(previous, page.messages) };
              setMessages((existing) => mergeChatMessages(
                existing.filter((message) => message.conversationId === conversationId), page.messages,
              ));
            },
            isCurrent,
          );
          if (data.conversation.id !== conversationId) throw new ChatRequestError("unexpected");
          if (epoch !== requestEpochRef.current || sequence !== messageReadSequenceRef.current) return false;
          setConversation(data.conversation);
          setMessageOwner(identity);
          setResolvedIdentity(identity);
          setReadError(null);
          // A lost POST response may still have committed. Only the exact UUID
          // proves delivery; equal message text is not a deduplication key.
          const pending = pendingMessageRef.current;
          if (pending?.conversationId === conversationId && mutationEpochRef.current === null
            && messageDataRef.current?.messages.some((item) => item.id === pending.clientMessageId)) {
            pendingMessageRef.current = null;
            setDraftMessage((current) => current === pending.originalDraft ? "" : current);
            setActionError((current) => current?.operation === "send" ? null : current);
          }
          return true;
        } catch (fetchError) {
          if (epoch !== requestEpochRef.current || sequence !== messageReadSequenceRef.current) return false;
          handleChatError(fetchError, "read", messageSent);
          return false;
        } finally {
          if (messageReadRef.current?.sequence === sequence) messageReadRef.current = null;
          if (epoch === requestEpochRef.current && sequence === messageReadSequenceRef.current) setRefreshing(false);
        }
      })();
      messageReadRef.current = { epoch, conversationId, sequence, promise };
      return promise;
    },
    [handleChatError, identity],
  );

  const hydrateConversation = useCallback(async () => {
    if (status === "loading" || !hydrated || startRequestEpochRef.current !== null
      || mutationEpochRef.current !== null) return;
    const epoch = requestEpochRef.current;
    const hydrationRequest = ++hydrationRequestRef.current;
    setLoading(true);
    setReadError(null);
    try {
      // Anonymous lists are scoped to the single cookie-owned conversation.
      const list = await fetchChatJson<ChatConversation[]>(
        "/api/chat/conversations?limit=10", undefined, isChatConversationList,
      );
      if (epoch !== requestEpochRef.current || hydrationRequest !== hydrationRequestRef.current) return;
      const preferred = list.find((item) => item.status !== "CLOSED") ?? list[0] ?? null;
      setConversation(preferred);
      let loaded = true;
      if (preferred) loaded = await loadMessages(preferred.id, true);
      else setMessages([]);
      if (epoch === requestEpochRef.current && hydrationRequest === hydrationRequestRef.current && loaded) {
        setResolvedIdentity(identity);
        // Recover a create response lost after its secure cookie was received.
        if (preferred) setActionError((current) => current?.operation === "start" ? null : current);
      }
    } catch (fetchError) {
      if (epoch !== requestEpochRef.current || hydrationRequest !== hydrationRequestRef.current) return;
      // No cookie is normal for a first-time guest. Never recover by email.
      if (!session?.user?.id && fetchError instanceof ChatRequestError && fetchError.status === 401) {
        setConversation(null);
        setMessages([]);
        setMessageOwner(null);
        setResolvedIdentity(identity);
        setReadError(null);
      } else {
        handleChatError(fetchError, "read");
      }
    } finally {
      if (epoch === requestEpochRef.current && hydrationRequest === hydrationRequestRef.current) setLoading(false);
    }
  }, [handleChatError, hydrated, identity, loadMessages, session?.user?.id, status]);

  useEffect(() => {
    if (!open) return;
    void hydrateConversation();
  }, [hydrateConversation, open]);

  useEffect(() => {
    if (!open || !shouldRender) return;
    let disposed = false;
    let busy = false;
    let generation = 0;
    let recheckRequested = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    const poll = async () => {
      if (disposed || busy || document.visibilityState !== "visible") return;
      if (!navigator.onLine) {
        clearTimeout(expiryTimer);
        setAgentStatus("UNKNOWN");
        return;
      }
      busy = true;
      recheckRequested = false;
      controller = new AbortController();
      const requestGeneration = generation;
      const startedAt = performance.now();
      try {
        const data = await fetchChatJson<ChatAvailability>(
          "/api/chat/availability", { signal: controller.signal }, isChatAvailability,
        );
        if (disposed || requestGeneration !== generation) {
          logChatAvailability("widget-availability-response-ignored", { reason: "superseded-read" });
          return;
        }
        clearTimeout(expiryTimer);
        // Conservatively subtract the whole round trip; stale leases cannot
        // keep an Online badge alive if polling or the agent's browser stops.
        const remaining = Math.max(0, data.availableForMs - (performance.now() - startedAt));
        logChatAvailability("widget-availability-result", { status: data.status, availableForMs: remaining });
        if (data.status === "UNAVAILABLE") {
          setAgentStatus("UNAVAILABLE");
        } else if (remaining > 0) {
          setAgentStatus("AVAILABLE");
          expiryTimer = setTimeout(() => {
            if (disposed) return;
            // This snapshot expiring does not prove that all agents are Away:
            // another heartbeat or workspace may have extended availability.
            setAgentStatus(navigator.onLine ? "CHECKING" : "UNKNOWN");
            refreshAvailability();
          }, remaining);
        } else {
          // Do not label a slow/expired AVAILABLE response as confirmed Offline.
          setAgentStatus("CHECKING");
          // Bounded retry delay avoids a tight loop at the lease boundary.
          expiryTimer = setTimeout(refreshAvailability, 1_000);
        }
      } catch (error: unknown) {
        if (!disposed && requestGeneration === generation) {
          clearTimeout(expiryTimer);
          setAgentStatus("UNKNOWN");
          const failure = error instanceof ChatRequestError ? error : new ChatRequestError("unexpected");
          logChatAvailability("widget-availability-failed", {
            reason: failure.code, errorKind: failure.kind, httpStatus: failure.status,
          });
        }
      } finally {
        busy = false;
        if (!disposed && recheckRequested && document.visibilityState === "visible" && navigator.onLine) {
          recheckRequested = false;
          void poll();
        }
      }
    };
    const refreshAvailability = () => {
      if (disposed) return;
      // An invalidation arriving during a request makes that snapshot stale.
      // Coalesce events into one fresh read, rather than applying the old result.
      generation += 1;
      logChatAvailability("widget-availability-refresh", { reason: "event-or-expiry", visibility: document.visibilityState });
      if (busy) recheckRequested = true;
      else void poll();
    };
    const visibility = () => {
      generation += 1;
      clearTimeout(expiryTimer);
      controller?.abort();
      setAgentStatus(navigator.onLine ? "CHECKING" : "UNKNOWN");
      if (document.visibilityState === "visible" && navigator.onLine) {
        if (busy) recheckRequested = true;
        else void poll();
      } else {
        // Browser timers can pause in a hidden tab. Never reuse its stale badge.
        recheckRequested = false;
      }
    };
    setAgentStatus(navigator.onLine ? "CHECKING" : "UNKNOWN");
    refreshAvailabilityRef.current = refreshAvailability;
    void poll();
    const interval = setInterval(() => void poll(), CHAT_AVAILABILITY_POLL_MS);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("online", visibility);
    window.addEventListener("offline", visibility);
    return () => {
      disposed = true;
      refreshAvailabilityRef.current = () => {};
      controller?.abort();
      clearInterval(interval);
      clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("online", visibility);
      window.removeEventListener("offline", visibility);
    };
  }, [open, shouldRender]);

  const { connectionStatus, remoteTyping, notifyTyping, requestSynchronize } = useSupportChatRealtime({
    enabled: open && shouldRender && status !== "loading" && hydrated,
    identity,
    conversationId: resolvedIdentity === identity ? conversation?.id ?? null : null,
    availability: true,
    onSynchronize: async () => {
      if (mutationEpochRef.current !== null || startRequestEpochRef.current !== null) return false;
      if (conversation?.id && resolvedIdentity === identity) return loadMessages(conversation.id, true);
      if (session?.user?.id) await hydrateConversation();
      return true;
    },
    onAvailability: () => refreshAvailabilityRef.current(),
    onAccessError: (error) => handleChatError(error, "read"),
  });

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open || resolvingConversation || starting || sending || closing || loading) return;
    if (showGuestForm) {
      guestNameInputRef.current?.focus({ preventScroll: true });
    } else {
      messageInputRef.current?.focus({ preventScroll: true });
    }
  }, [closing, loading, open, resolvingConversation, sending, showGuestForm, starting]);

  const persistGuestProfile = useCallback((profile: GuestChatProfile) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LS_GUEST_NAME, profile.guestName);
      localStorage.setItem(LS_GUEST_EMAIL, profile.guestEmail);
    } catch {
      // Contact preferences are optional; credentials are never stored here.
    }
  }, []);

  const createConversation = useCallback(
    async (guestProfile?: GuestChatProfile, hydrateMessages = true) => {
      const epoch = requestEpochRef.current;
      // Late reads must not overwrite a newly created conversation.
      hydrationRequestRef.current += 1;
      messageReadSequenceRef.current += 1;
      messageReadRef.current = null;
      setLoading(false);
      setRefreshing(false);
      const body: Record<string, unknown> = { message: "", quickAction: "", orderReference: "" };
      if (!session?.user?.id) {
        body.guestName = guestProfile?.guestName ?? guestName.trim();
        body.guestEmail = guestProfile?.guestEmail ?? guestEmail.trim().toLowerCase();
      }
      const created = await fetchChatJson<ChatConversation>(
        "/api/chat/conversations",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        isChatConversation,
      );
      if (epoch !== requestEpochRef.current) throw new ChatRequestError("authentication");
      setConversation(created);
      setMessageOwner(identity);
      setResolvedIdentity(identity);
      if (hydrateMessages) await loadMessages(created.id, false);
      return created;
    },
    [guestEmail, guestName, identity, loadMessages, session?.user?.id],
  );

  const startGuestChat = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!showGuestForm || starting || startRequestEpochRef.current !== null
      || mutationEpochRef.current !== null) return;

    const formData = new FormData(event.currentTarget);
    const validation = validateGuestChatProfile(formData.get("guestName"), formData.get("guestEmail"));
    setGuestFieldErrors(validation.success ? {} : validation.errors);
    setActionError(null);
    if (!validation.success) {
      if (validation.errors.guestName) guestNameInputRef.current?.focus();
      else guestEmailInputRef.current?.focus();
      return;
    }

    const epoch = requestEpochRef.current;
    startRequestEpochRef.current = epoch;
    setStarting(true);
    try {
      // Empty creation keeps first-message retries on the idempotent message API.
      // Contact fields are not credentials; ownership comes from the HttpOnly cookie.
      await createConversation(validation.profile);
      if (epoch !== requestEpochRef.current) return;
      setGuestName(validation.profile.guestName);
      setGuestEmail(validation.profile.guestEmail);
      persistGuestProfile(validation.profile);
    } catch (startError) {
      if (epoch !== requestEpochRef.current) return;
      if (startError instanceof ChatRequestError && startError.kind === "validation") {
        setGuestFieldErrors({
          ...(startError.fields?.guestName ? { guestName: "Please enter a valid name (2–120 characters)." } : {}),
          ...(startError.fields?.guestEmail ? { guestEmail: "Please enter a valid email address." } : {}),
        });
      }
      handleChatError(startError, "start");
    } finally {
      if (startRequestEpochRef.current === epoch) startRequestEpochRef.current = null;
      if (epoch === requestEpochRef.current) setStarting(false);
    }
  }, [createConversation, handleChatError, persistGuestProfile, showGuestForm, starting]);

  const sendMessage = useCallback(
    async (quickAction?: string) => {
      // The ref locks synchronously, before React renders a disabled button.
      if (mutationEpochRef.current !== null || startRequestEpochRef.current !== null
        || sending || starting || closing || loading || resolvingConversation) return;
      if (!session?.user?.id && !conversation?.id) return;
      const epoch = requestEpochRef.current;
      const messageText = draftMessage.trim()
        || (quickAction ? `I need help regarding ${quickAction.toLowerCase()}.` : "");
      if (!messageText || messageText.length > 4000) {
        handleChatError(new ChatRequestError(
          "validation", 400, messageText ? "MESSAGE_TOO_LONG" : "MESSAGE_EMPTY",
        ), "send");
        messageInputRef.current?.focus();
        return;
      }

      mutationEpochRef.current = epoch;
      notifyTyping(false);
      messageReadSequenceRef.current += 1;
      messageReadRef.current = null;
      setRefreshing(false);
      setSending(true);
      setActionError(null);
      // Retain quick-action text too if its request fails.
      const originalDraft = draftMessage.trim() ? draftMessage : messageText;
      if (!draftMessage.trim()) setDraftMessage(originalDraft);
      try {
        const previous = pendingMessageRef.current;
        const sameText = previous?.message === messageText;
        const effectiveAction = quickAction ?? (sameText ? previous?.quickAction : "") ?? "";
        const reference = orderReference.trim();
        const reuse = previous && sameText && previous.quickAction === effectiveAction
          && previous.orderReference === reference
          && (previous.conversationId === (conversation?.id ?? null));
        const pending: PendingChatMessage = reuse && previous ? { ...previous, originalDraft } : {
          clientMessageId: createChatMessageId(),
          conversationId: conversation?.id ?? null,
          message: messageText,
          quickAction: effectiveAction,
          orderReference: reference,
          originalDraft,
        };
        pendingMessageRef.current = pending;
        // Do not include the first message in non-idempotent conversation creation.
        if (!pending.conversationId) {
          const created = await createConversation(undefined, false);
          if (epoch !== requestEpochRef.current) return;
          pending.conversationId = created.id;
        }
        const createdMessage = await fetchChatJson<ChatMessage>(
          `/api/chat/conversations/${pending.conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: pending.message, quickAction: pending.quickAction,
              orderReference: pending.orderReference, clientMessageId: pending.clientMessageId,
            }),
          },
          isChatMessage,
        );
        if (createdMessage.id !== pending.clientMessageId
          || createdMessage.conversationId !== pending.conversationId) throw new ChatRequestError("unexpected");
        if (epoch !== requestEpochRef.current) return;
        pendingMessageRef.current = null;
        setActionError(null);
        setMessages((current) => current.some((item) => item.id === createdMessage.id)
          ? current : [...current, createdMessage]);
        setMessageOwner(identity);
        setDraftMessage((current) => current === originalDraft ? "" : current);
        // A refresh failure must not present a Send retry after confirmed delivery.
        await loadMessages(pending.conversationId, false, true);
      } catch (sendError) {
        if (epoch === requestEpochRef.current) handleChatError(sendError, "send");
      } finally {
        if (mutationEpochRef.current === epoch) mutationEpochRef.current = null;
        if (epoch === requestEpochRef.current) setSending(false);
        requestSynchronize();
      }
    },
    [closing, conversation?.id, createConversation, draftMessage, handleChatError, identity,
      loading, loadMessages, notifyTyping, orderReference, requestSynchronize, resolvingConversation, sending, session?.user?.id, starting],
  );

  const closeConversation = useCallback(async () => {
    if (!conversation?.id || sending || closing || starting || loading || resolvingConversation
      || mutationEpochRef.current !== null || startRequestEpochRef.current !== null) return;
    const epoch = requestEpochRef.current;
    mutationEpochRef.current = epoch;
    messageReadSequenceRef.current += 1;
    messageReadRef.current = null;
    setRefreshing(false);
    setClosing(true);
    setActionError(null);
    try {
      const updated = await fetchChatJson<ChatConversation>(
        `/api/chat/conversations/${conversation.id}`,
        {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CLOSED", rating, feedback: feedback.trim() }),
        },
        isChatConversation,
      );
      if (updated.id !== conversation.id) throw new ChatRequestError("unexpected");
      if (epoch !== requestEpochRef.current) return;
      setConversation(updated);
      setShowFeedback(false);
      setFeedback("");
      await loadMessages(updated.id, false);
    } catch (closeError) {
      if (epoch === requestEpochRef.current) handleChatError(closeError, "close");
    } finally {
      if (mutationEpochRef.current === epoch) mutationEpochRef.current = null;
      if (epoch === requestEpochRef.current) setClosing(false);
    }
  }, [closing, conversation?.id, feedback, handleChatError, loading, loadMessages,
    rating, resolvingConversation, sending, starting]);

  const activeError = actionError ?? readError;
  const requestBusy = loading || starting || sending || closing || refreshing;
  const retryRequest = () => {
    if (!activeError?.retryable || requestBusy) return;
    if (activeError.operation === "send") void sendMessage();
    else if (activeError.operation === "start" && showGuestForm) guestFormRef.current?.requestSubmit();
    // Do not blindly repeat a close/feedback PATCH: refresh to check its outcome.
    else if (conversation?.id) {
      void loadMessages(conversation.id, false).then((loaded) => {
        if (loaded) setActionError((current) => current?.operation === "close" ? null : current);
      });
    } else void hydrateConversation();
  };

  if (!shouldRender) return null;

  const sendDisabled = sending || starting || closing || loading || resolvingConversation
    || (!session?.user?.id && !conversation);
  // Hide old account data immediately, before the identity-reset effect runs.
  const visibleMessages = messageOwner === identity ? messages : [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="fixed bottom-[10px] right-1 z-40">
          <button
            type="button"
            aria-label="Open customer support chat"
            className="group flex h-12 w-12 items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-300 pr-3 hover:w-[145px] hover:pr-4"
          >
            <span className="flex h-12 w-12 min-w-12 items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
            </span>

            <span className="pointer-events-none whitespace-nowrap text-sm font-semibold text-primary-foreground opacity-0 transition-all duration-300 group-hover:opacity-100">
              Live Support
            </span>
          </button>
        </div>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="!top-auto !bottom-2 !right-2 !h-[calc(100dvh_-_1rem)] !max-h-[640px] !w-[calc(100vw_-_1rem)] !max-w-[380px] gap-0 overflow-hidden rounded-xl shadow-2xl flex flex-col p-0 sm:!bottom-6 sm:!right-6 sm:!h-[min(640px,80dvh)] sm:!max-h-[calc(100dvh_-_3rem)]"
      >
        <div className="shrink-0 rounded-xl">
          {/* HEADER */}
          <SheetHeader className="h-auto min-h-16 flex-nowrap items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/90 px-4 py-3 text-primary-foreground rounded-t-xl">
            <div className="min-w-0">
              <SheetTitle className="text-sm text-primary-foreground font-semibold">
                Customer Support
              </SheetTitle>
              <SheetDescription className="p-0 text-[11px] text-primary-foreground/80">
                {agentStatus === "AVAILABLE" ? "A support agent is available to help."
                  : agentStatus === "UNAVAILABLE" ? "Leave a message. We’ll reply when an agent is available."
                  : agentStatus === "CHECKING" ? "Checking support availability…"
                  : "Agent status unavailable. You can still leave a message."}
              </SheetDescription>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                role="status"
                aria-live="polite"
                className={`rounded-full px-2 py-1 text-[10px] text-primary-foreground ${agentStatus === "AVAILABLE" ? "bg-emerald-500/30" : "bg-accent/20"}`}
              >
                {agentStatus === "AVAILABLE" ? "Available" : agentStatus === "UNAVAILABLE" ? "Offline"
                  : agentStatus === "CHECKING" ? "Checking…" : "Status unavailable"}
              </span>

              <button
                type="button"
                aria-label="Hide customer support chat"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-white/10"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>
        </div>

        <p role="status" aria-live="polite" title="Message connection status. Support agent availability is shown above."
          className="shrink-0 border-b px-4 py-1.5 text-[11px] text-muted-foreground">
          {connectionStatus === "live" ? "Live message connection active" : CHAT_CONNECTION_LABELS[connectionStatus]}
        </p>

        {activeError && (
          <div
            id="support-chat-request-error"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="max-h-[35%] shrink-0 overflow-y-auto border-b border-destructive/20 bg-destructive/5 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-destructive">{activeError.title}</p>
                <p className="text-xs leading-relaxed text-foreground">{activeError.message}</p>
                {activeError.retryable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={requestBusy}
                    onClick={retryRequest}
                    className="mt-2 h-8"
                  >
                    <RotateCcw aria-hidden="true" className="h-3 w-3" />
                    {activeError.operation === "send" ? "Retry message"
                      : activeError.operation === "start" ? "Retry starting chat" : "Refresh chat"}
                  </Button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss chat error"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10"
                onClick={() => actionError ? setActionError(null) : setReadError(null)}
              >
                <XCircle aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* CHAT MESSAGES */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 p-4">
          {resolvingConversation ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              {loading || status === "loading" || !hydrated ? (
                <>
                  <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
                  <p role="status" className="text-sm text-muted-foreground">Loading secure chat…</p>
                </>
              ) : (
                <Button type="button" variant="outline" disabled={requestBusy} onClick={() => void hydrateConversation()}>
                  Retry opening chat
                </Button>
              )}
            </div>
          ) : showGuestForm ? (
            <form
              ref={guestFormRef}
              noValidate
              onSubmit={startGuestChat}
              aria-labelledby="support-chat-welcome-title"
              aria-busy={starting}
              className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="space-y-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 id="support-chat-welcome-title" className="text-base font-semibold text-card-foreground">
                  Let’s start a conversation
                </h2>
                <p className="text-sm text-muted-foreground">Tell us your name and contact email so our team can help you.</p>
              </div>

              <fieldset disabled={starting} className="min-w-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="support-chat-guest-name">Your name <span aria-hidden="true">*</span></Label>
                  <Input
                    ref={guestNameInputRef}
                    id="support-chat-guest-name"
                    name="guestName"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                    value={guestName}
                    placeholder="Enter your name"
                    aria-invalid={Boolean(guestFieldErrors.guestName)}
                    aria-describedby={guestFieldErrors.guestName ? "support-chat-name-error" : undefined}
                    onChange={(event) => {
                      setGuestName(event.target.value);
                      setGuestFieldErrors((current) => ({ ...current, guestName: undefined }));
                    }}
                    className="h-11 bg-background text-base"
                  />
                  {guestFieldErrors.guestName && (
                    <p id="support-chat-name-error" role="alert" className="text-xs text-destructive">{guestFieldErrors.guestName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-chat-guest-email">Contact email <span aria-hidden="true">*</span></Label>
                  <Input
                    ref={guestEmailInputRef}
                    id="support-chat-guest-email"
                    name="guestEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                    value={guestEmail}
                    placeholder="name@example.com"
                    aria-invalid={Boolean(guestFieldErrors.guestEmail)}
                    aria-describedby={`support-chat-email-help${guestFieldErrors.guestEmail ? " support-chat-email-error" : ""}`}
                    onChange={(event) => {
                      setGuestEmail(event.target.value);
                      setGuestFieldErrors((current) => ({ ...current, guestEmail: undefined }));
                    }}
                    className="h-11 bg-background text-base"
                  />
                  {guestFieldErrors.guestEmail && (
                    <p id="support-chat-email-error" role="alert" className="text-xs text-destructive">{guestFieldErrors.guestEmail}</p>
                  )}
                  <p id="support-chat-email-help" className="text-xs text-muted-foreground">Used to contact you, not to unlock previous chats.</p>
                </div>
                <Button type="submit" disabled={starting} className="h-11 w-full">
                  {starting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <MessageCircle aria-hidden="true" />}
                  {starting ? "Starting secure chat…" : "Start Chat"}
                </Button>
              </fieldset>
              <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>This browser can reopen your chat for 7 days using a secure cookie. If that cookie is lost or expires, start a new chat. Email alone cannot restore old chats.</p>
              </div>
            </form>
          ) : visibleMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Send your first message. Our team will reply shortly.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleMessages.map((item) => {
                const mine = item.senderRole === role;

                return (
                  <div
                    key={item.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-card-foreground border border-border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{item.message}</p>

                      <p
                        className={`mt-1 text-[11px] ${
                          mine
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatChatTime(item.createdAt)}
                        {mine ? ` · ${item.isRead ? "Read" : "Sent"}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        {!resolvingConversation && !showGuestForm && (
          <div className="shrink-0 border-t bg-background p-3 space-y-3">
            {remoteTyping && (
              <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Support agent is typing…</p>
            )}
            {/* QUICK ACTIONS */}
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={sendDisabled}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                  onClick={() => void sendMessage(action)}
                >
                  {action}
                </button>
              ))}
            </div>

            {/* MESSAGE BOX */}
            <div className="flex items-end gap-2">
              <textarea
                ref={messageInputRef}
                aria-label="Your message"
                aria-invalid={actionError?.operation === "send" && actionError.kind === "validation"}
                aria-describedby={activeError ? "support-chat-request-error support-chat-send-status" : "support-chat-send-status"}
                disabled={sendDisabled}
                value={draftMessage}
                onChange={(event) => {
                  setDraftMessage(event.target.value);
                  notifyTyping(Boolean(event.target.value.trim()));
                }}
                onBlur={() => notifyTyping(false)}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
                placeholder="Type your message..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    if (event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />

              <Button
                type="button"
                aria-label={sending ? "Sending message" : "Send message"}
                size="icon"
                onClick={() => void sendMessage()}
                disabled={sendDisabled}
              >
                {sending
                  ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  : <Send aria-hidden="true" className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <p id="support-chat-send-status" role="status" aria-live="polite">
                {refreshing ? "Refreshing chat…" : sending ? "Sending message…" : closing ? "Updating chat…" : "Enter to send · Shift+Enter for a new line"}
              </p>
              <span className={`shrink-0 ${draftMessage.trim().length > 4000 ? "text-destructive" : ""}`}>
                {draftMessage.trim().length}/4,000
              </span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
