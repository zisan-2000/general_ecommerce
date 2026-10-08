"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import GradientBorder from "../ui/GradientBorder";

type ChatStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
type SenderRole = "admin" | "user" | "guest" | string;

type ChatConversation = {
  id: string;
  status: ChatStatus;
  priority: "LOW" | "NORMAL" | "HIGH";
  guestEmail?: string | null;
  guestName?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
};

type ChatMessage = {
  id: string;
  senderRole: SenderRole;
  message: string;
  attachmentUrl?: string | null;
  createdAt: string;
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

class ChatRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === "string" ? payload.error : "Request failed.";
    throw new ChatRequestError(errorMessage, response.status);
  }
  return payload as T;
}

export default function SupportChatWidget() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const requestEpochRef = useRef(0);
  const [messageOwner, setMessageOwner] = useState<string | null>(null);
  const identity = status === "loading" ? "loading" : session?.user?.id ?? "guest";
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
    setError(null);
    setLoading(false);
    setSending(false);
    setDraftMessage("");
    setShowFeedback(false);
    setFeedback("");
    return () => { requestEpochRef.current += 1; };
  }, [identity]);

  const handleChatError = useCallback(
    (fetchError: unknown, fallback: string) => {
      if (!session?.user?.id && fetchError instanceof ChatRequestError
        && (fetchError.status === 401 || fetchError.status === 403)) {
        setConversation(null);
        setMessages([]);
        setMessageOwner(null);
        setError("Your secure chat session is unavailable or expired. Start a new chat; email alone cannot restore previous chats.");
        return;
      }
      setError(fetchError instanceof Error ? fetchError.message : fallback);
    },
    [session?.user?.id],
  );

  const loadMessages = useCallback(
    async (conversationId: string, silent = true) => {
      const epoch = requestEpochRef.current;
      const params = new URLSearchParams();
      params.set("limit", "120");
      params.set("markRead", "true");
      if (!silent) setLoading(true);
      try {
        const data = await fetchJson<{
          conversation: ChatConversation;
          messages: ChatMessage[];
        }>(
          `/api/chat/conversations/${conversationId}/messages?${params.toString()}`,
        );
        if (epoch !== requestEpochRef.current) return;
        setConversation(data.conversation);
        setMessages(data.messages);
        setMessageOwner(identity);
        setError(null);
      } catch (fetchError) {
        if (epoch !== requestEpochRef.current) return;
        handleChatError(fetchError, "Failed to load messages.");
      } finally {
        if (!silent && epoch === requestEpochRef.current) setLoading(false);
      }
    },
    [handleChatError, identity],
  );

  const hydrateConversation = useCallback(async () => {
    if (status === "loading" || !hydrated) return;
    const epoch = requestEpochRef.current;
    setLoading(true);
    setError(null);
    try {
      // The server scopes anonymous lists to the single cookie-owned conversation.
      const list = await fetchJson<ChatConversation[]>("/api/chat/conversations?limit=10");
      if (epoch !== requestEpochRef.current) return;
      const preferred = list.find((item) => item.status !== "CLOSED") ?? list[0] ?? null;
      setConversation(preferred);
      if (preferred) {
        await loadMessages(preferred.id, true);
      } else {
        setMessages([]);
      }
    } catch (fetchError) {
      if (epoch !== requestEpochRef.current) return;
      // No cookie is normal for a first-time guest; do not recover by email.
      if (!session?.user?.id && fetchError instanceof ChatRequestError && fetchError.status === 401) {
        setConversation(null);
        setMessages([]);
      } else {
        handleChatError(fetchError, "Failed to load conversation.");
      }
    } finally {
      if (epoch === requestEpochRef.current) setLoading(false);
    }
  }, [
    handleChatError,
    hydrated,
    loadMessages,
    session?.user?.id,
    status,
  ]);

  useEffect(() => {
    if (!open) return;
    void hydrateConversation();
  }, [hydrateConversation, open]);

  useEffect(() => {
    if (!open || !conversation?.id || status === "loading") return;
    const interval = setInterval(() => {
      void loadMessages(conversation.id, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [conversation?.id, loadMessages, open, status]);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const persistGuestProfile = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LS_GUEST_NAME, guestName.trim());
      localStorage.setItem(LS_GUEST_EMAIL, guestEmail.trim().toLowerCase());
    } catch {
      // Contact preferences are optional; credentials are never stored here.
    }
  }, [guestEmail, guestName]);

  const createConversation = useCallback(
    async (payload?: {
      message?: string;
      quickAction?: string;
      orderReference?: string;
    }) => {
      const epoch = requestEpochRef.current;
      const body: Record<string, unknown> = {
        message: payload?.message ?? "",
        quickAction: payload?.quickAction ?? "",
        orderReference: payload?.orderReference ?? "",
      };

      if (!session?.user?.id) {
        body.guestName = guestName.trim();
        body.guestEmail = guestEmail.trim().toLowerCase();
      }

      const created = await fetchJson<ChatConversation>(
        "/api/chat/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (epoch !== requestEpochRef.current) throw new Error("Chat identity changed. Please retry.");
      setConversation(created);
      await loadMessages(created.id, false);
      return created;
    },
    [
      guestEmail,
      guestName,
      loadMessages,
      session?.user?.id,
    ],
  );

  const sendMessage = useCallback(
    async (quickAction?: string) => {
      if (sending || loading || status === "loading" || !hydrated) return;
      if (!session?.user?.id && !conversation?.id
        && (guestName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()))) {
        setError("Enter your name and a valid contact email to start a new chat.");
        return;
      }
      const epoch = requestEpochRef.current;
      const messageText =
        draftMessage.trim() ||
        (quickAction
          ? `I need help regarding ${quickAction.toLowerCase()}.`
          : "");

      if (!messageText && !quickAction) return;

      setSending(true);
      setError(null);
      try {
        if (!conversation?.id) {
          if (!session?.user?.id) persistGuestProfile();
          await createConversation({
            message: messageText,
            quickAction: quickAction ?? "",
            orderReference: orderReference.trim(),
          });
        } else {
          const body: Record<string, unknown> = {
            message: messageText,
            quickAction: quickAction ?? "",
            orderReference: orderReference.trim(),
          };
          await fetchJson(
            `/api/chat/conversations/${conversation.id}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          if (epoch !== requestEpochRef.current) return;
          await loadMessages(conversation.id, true);
        }
        if (epoch === requestEpochRef.current) setDraftMessage("");
      } catch (sendError) {
        if (epoch !== requestEpochRef.current) return;
        handleChatError(sendError, "Failed to send message.");
      } finally {
        if (epoch === requestEpochRef.current) setSending(false);
      }
    },
    [
      conversation?.id,
      createConversation,
      draftMessage,
      guestEmail,
      guestName,
      handleChatError,
      hydrated,
      loading,
      loadMessages,
      orderReference,
      persistGuestProfile,
      sending,
      session?.user?.id,
      status,
    ],
  );

  const closeConversation = useCallback(async () => {
    if (!conversation?.id || sending || loading || status === "loading") return;
    const epoch = requestEpochRef.current;
    setSending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        status: "CLOSED",
        rating,
        feedback: feedback.trim(),
      };
      const updated = await fetchJson<ChatConversation>(
        `/api/chat/conversations/${conversation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (epoch !== requestEpochRef.current) return;
      setConversation(updated);
      setShowFeedback(false);
      setFeedback("");
      await loadMessages(updated.id, true);
    } catch (closeError) {
      if (epoch !== requestEpochRef.current) return;
      handleChatError(closeError, "Failed to close chat.");
    } finally {
      if (epoch === requestEpochRef.current) setSending(false);
    }
  }, [
    conversation?.id,
    feedback,
    handleChatError,
    loading,
    loadMessages,
    rating,
    sending,
    status,
  ]);

  if (!shouldRender) return null;

  const guestReady = guestName.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const sendDisabled = sending || loading || status === "loading" || !hydrated
    || (!session?.user?.id && !conversation && !guestReady);
  // Hide old account data immediately, before the identity-reset effect runs.
  const visibleMessages = messageOwner === identity ? messages : [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="fixed bottom-[10px] right-1 z-40">
          <button
            type="button"
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
        className="!top-auto !bottom-6 !right-6 h-[60vh] sm:w-[380px] rounded-xl shadow-2xl flex flex-col p-0"
      >
        <div className="rounded-xl">
          {/* HEADER */}
          <SheetHeader className="flex items-center justify-between bg-gradient-to-r from-primary to-primary/90 px-4 py-3 text-primary-foreground rounded-xl">
            <div>
              <SheetTitle className="text-sm text-primary-foreground font-semibold">
                Customer Support
              </SheetTitle>
              <SheetDescription className="text-[11px] text-primary-foreground/80">
                Average response under 15 minutes
              </SheetDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/20 px-2 py-1 text-[10px] text-primary-foreground">
                Online
              </span>

              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-white/10"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>
        </div>

        {/* CHAT MESSAGES */}
        <div className="flex-1 overflow-y-auto bg-muted/30 p-4">
          {!session?.user?.id && !conversation && (
            <div className="mb-4 space-y-2">
              <label className="block text-xs font-medium" htmlFor="support-chat-guest-name">
                Your name
              </label>
              <input
                id="support-chat-guest-name"
                autoComplete="name"
                value={guestName}
                maxLength={120}
                onChange={(event) => setGuestName(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <label className="block text-xs font-medium" htmlFor="support-chat-guest-email">
                Contact email
              </label>
              <input
                id="support-chat-guest-email"
                type="email"
                autoComplete="email"
                value={guestEmail}
                maxLength={254}
                onChange={(event) => setGuestEmail(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This browser can reopen your chat for 7 days using a secure cookie. Email alone cannot restore old chats. If that cookie is lost or expires, start a new chat.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
          )}
          {loading && (
            <p role="status" className="mb-3 text-xs text-muted-foreground">Loading secure chat…</p>
          )}
          {visibleMessages.length === 0 ? (
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
                      <p className="whitespace-pre-wrap">{item.message}</p>

                      <p
                        className={`mt-1 text-[11px] ${
                          mine
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatChatTime(item.createdAt)}
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
        <div className="border-t bg-background p-3 space-y-3">
          {/* QUICK ACTIONS */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                disabled={sendDisabled}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void sendMessage(action)}
              >
                {action}
              </button>
            ))}
          </div>

          {/* MESSAGE BOX */}
          <div className="flex items-end gap-2">
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              rows={2}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Type your message..."
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />

            <Button
              size="icon"
              onClick={() => void sendMessage()}
              disabled={sendDisabled}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
