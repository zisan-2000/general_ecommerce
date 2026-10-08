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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === "string" ? payload.error : "Request failed.";
    throw new Error(errorMessage);
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
    setGuestName(localStorage.getItem(LS_GUEST_NAME) || "");
    setGuestEmail(localStorage.getItem(LS_GUEST_EMAIL) || "");
    setHydrated(true);
  }, []);

  const syncConversationToLocal = useCallback(
    (conversationId: string | null) => {
      if (typeof window === "undefined") return;
      if (!conversationId) {
        localStorage.removeItem(LS_CONVERSATION_ID);
        return;
      }
      localStorage.setItem(LS_CONVERSATION_ID, conversationId);
    },
    [],
  );

  const loadMessages = useCallback(
    async (conversationId: string, silent = true) => {
      const params = new URLSearchParams();
      params.set("limit", "120");
      params.set("markRead", "true");
      if (!session?.user?.id && guestEmail)
        params.set("guestEmail", guestEmail);

      if (!silent) setLoading(true);
      try {
        const data = await fetchJson<{
          conversation: ChatConversation;
          messages: ChatMessage[];
        }>(
          `/api/chat/conversations/${conversationId}/messages?${params.toString()}`,
        );
        setConversation(data.conversation);
        setMessages(data.messages);
        setError(null);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load messages.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [guestEmail, session?.user?.id],
  );

  const hydrateConversation = useCallback(async () => {
    if (status === "loading") return;
    setLoading(true);
    setError(null);
    try {
      if (session?.user?.id) {
        const list = await fetchJson<ChatConversation[]>(
          `/api/chat/conversations?limit=10`,
        );
        const preferred =
          list.find((item) => item.status !== "CLOSED") ?? list[0] ?? null;
        setConversation(preferred);
        syncConversationToLocal(preferred?.id ?? null);
        if (preferred) {
          await loadMessages(preferred.id, true);
        } else {
          setMessages([]);
        }
      } else {
        if (!hydrated) return;
        const existingId =
          typeof window !== "undefined"
            ? localStorage.getItem(LS_CONVERSATION_ID)
            : null;
        if (existingId && guestEmail) {
          await loadMessages(existingId, true);
        } else {
          setConversation(null);
          setMessages([]);
        }
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load conversation.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    guestEmail,
    hydrated,
    loadMessages,
    session?.user?.id,
    status,
    syncConversationToLocal,
  ]);

  useEffect(() => {
    if (!open) return;
    void hydrateConversation();
  }, [hydrateConversation, open]);

  useEffect(() => {
    if (!open || !conversation?.id) return;
    const interval = setInterval(() => {
      void loadMessages(conversation.id, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [conversation?.id, loadMessages, open]);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const persistGuestProfile = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_GUEST_NAME, guestName.trim());
    localStorage.setItem(LS_GUEST_EMAIL, guestEmail.trim().toLowerCase());
  }, [guestEmail, guestName]);

  const createConversation = useCallback(
    async (payload?: {
      message?: string;
      quickAction?: string;
      orderReference?: string;
    }) => {
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

      setConversation(created);
      syncConversationToLocal(created.id);
      await loadMessages(created.id, false);
      return created;
    },
    [
      guestEmail,
      guestName,
      loadMessages,
      session?.user?.id,
      syncConversationToLocal,
    ],
  );

  const sendMessage = useCallback(
    async (quickAction?: string) => {
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
          if (!session?.user?.id) {
            body.guestEmail = guestEmail.trim().toLowerCase();
          }
          await fetchJson(
            `/api/chat/conversations/${conversation.id}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          await loadMessages(conversation.id, true);
        }
        setDraftMessage("");
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Failed to send message.",
        );
      } finally {
        setSending(false);
      }
    },
    [
      conversation?.id,
      createConversation,
      draftMessage,
      guestEmail,
      loadMessages,
      orderReference,
      session?.user?.id,
    ],
  );

  const closeConversation = useCallback(async () => {
    if (!conversation?.id) return;
    setSending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        status: "CLOSED",
        rating,
        feedback: feedback.trim(),
      };
      if (!session?.user?.id) {
        body.guestEmail = guestEmail.trim().toLowerCase();
      }
      const updated = await fetchJson<ChatConversation>(
        `/api/chat/conversations/${conversation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setConversation(updated);
      setShowFeedback(false);
      setFeedback("");
      await loadMessages(updated.id, true);
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Failed to close chat.",
      );
    } finally {
      setSending(false);
    }
  }, [
    conversation?.id,
    feedback,
    guestEmail,
    loadMessages,
    rating,
    session?.user?.id,
  ]);

  if (!shouldRender) return null;

  const guestReady = guestName.trim().length > 1 && guestEmail.includes("@");

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
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Send your first message. Our team will reply shortly.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((item) => {
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
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary hover:bg-interaction/10"
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
              disabled={sending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
