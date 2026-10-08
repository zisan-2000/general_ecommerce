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
import { LoaderCircle, MessageCircle, Send, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [starting, setStarting] = useState(false);
  const [guestFieldErrors, setGuestFieldErrors] = useState<GuestChatProfileErrors>({});
  const [resolvedIdentity, setResolvedIdentity] = useState<string | null>(null);
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
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const guestNameInputRef = useRef<HTMLInputElement | null>(null);
  const guestEmailInputRef = useRef<HTMLInputElement | null>(null);
  const startRequestEpochRef = useRef<number | null>(null);
  const hydrationRequestRef = useRef(0);
  const requestEpochRef = useRef(0);
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
    setError(null);
    setLoading(false);
    setSending(false);
    setStarting(false);
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
    if (status === "loading" || !hydrated || startRequestEpochRef.current !== null) return;
    const epoch = requestEpochRef.current;
    const hydrationRequest = ++hydrationRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      // The server scopes anonymous lists to the single cookie-owned conversation.
      const list = await fetchJson<ChatConversation[]>("/api/chat/conversations?limit=10");
      if (epoch !== requestEpochRef.current || hydrationRequest !== hydrationRequestRef.current) return;
      const preferred = list.find((item) => item.status !== "CLOSED") ?? list[0] ?? null;
      setConversation(preferred);
      if (preferred) {
        await loadMessages(preferred.id, true);
      } else {
        setMessages([]);
      }
      if (epoch === requestEpochRef.current && hydrationRequest === hydrationRequestRef.current) {
        setResolvedIdentity(identity);
      }
    } catch (fetchError) {
      if (epoch !== requestEpochRef.current || hydrationRequest !== hydrationRequestRef.current) return;
      // No cookie is normal for a first-time guest; do not recover by email.
      if (!session?.user?.id && fetchError instanceof ChatRequestError && fetchError.status === 401) {
        setConversation(null);
        setMessages([]);
        setResolvedIdentity(identity);
      } else {
        handleChatError(fetchError, "Failed to load conversation.");
      }
    } finally {
      if (epoch === requestEpochRef.current && hydrationRequest === hydrationRequestRef.current) {
        setLoading(false);
      }
    }
  }, [
    handleChatError,
    hydrated,
    identity,
    loadMessages,
    session?.user?.id,
    status,
  ]);

  useEffect(() => {
    if (!open) return;
    void hydrateConversation();
  }, [hydrateConversation, open]);

  useEffect(() => {
    if (!open || !conversation?.id || starting || resolvingConversation) return;
    const interval = setInterval(() => {
      void loadMessages(conversation.id, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [conversation?.id, loadMessages, open, resolvingConversation, starting]);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open || resolvingConversation || starting || sending || loading) return;
    if (showGuestForm) {
      guestNameInputRef.current?.focus({ preventScroll: true });
    } else {
      messageInputRef.current?.focus({ preventScroll: true });
    }
  }, [loading, open, resolvingConversation, sending, showGuestForm, starting]);

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
    async (payload?: {
      message?: string;
      quickAction?: string;
      orderReference?: string;
      guestProfile?: GuestChatProfile;
    }) => {
      const epoch = requestEpochRef.current;
      // A late resume request must not overwrite a newly created conversation.
      hydrationRequestRef.current += 1;
      setLoading(false);
      const body: Record<string, unknown> = {
        message: payload?.message ?? "",
        quickAction: payload?.quickAction ?? "",
        orderReference: payload?.orderReference ?? "",
      };

      if (!session?.user?.id) {
        body.guestName = payload?.guestProfile?.guestName ?? guestName.trim();
        body.guestEmail = payload?.guestProfile?.guestEmail ?? guestEmail.trim().toLowerCase();
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
      if (!created || typeof created.id !== "string" || !created.id) {
        throw new Error("Chat could not be started. Please try again.");
      }
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

  const startGuestChat = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!showGuestForm || starting || startRequestEpochRef.current !== null) return;

    const formData = new FormData(event.currentTarget);
    const validation = validateGuestChatProfile(formData.get("guestName"), formData.get("guestEmail"));
    setGuestFieldErrors(validation.success ? {} : validation.errors);
    if (!validation.success) {
      if (validation.errors.guestName) guestNameInputRef.current?.focus();
      else guestEmailInputRef.current?.focus();
      return;
    }

    const epoch = requestEpochRef.current;
    startRequestEpochRef.current = epoch;
    setStarting(true);
    setError(null);
    try {
      // An empty initial message is supported by the existing create API.
      // Ownership comes from its HttpOnly cookie, never from these contact fields.
      await createConversation({ guestProfile: validation.profile });
      if (epoch !== requestEpochRef.current) return;
      setGuestName(validation.profile.guestName);
      setGuestEmail(validation.profile.guestEmail);
      persistGuestProfile(validation.profile);
    } catch (startError) {
      if (epoch !== requestEpochRef.current) return;
      handleChatError(startError, "Failed to start chat. Please try again.");
    } finally {
      if (startRequestEpochRef.current === epoch) startRequestEpochRef.current = null;
      if (epoch === requestEpochRef.current) setStarting(false);
    }
  }, [
    createConversation,
    handleChatError,
    persistGuestProfile,
    showGuestForm,
    starting,
  ]);

  const sendMessage = useCallback(
    async (quickAction?: string) => {
      if (sending || starting || loading || resolvingConversation) return;
      // Anonymous customers must submit the profile form before using the composer.
      if (!session?.user?.id && !conversation?.id) return;
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
      handleChatError,
      loading,
      loadMessages,
      orderReference,
      resolvingConversation,
      sending,
      session?.user?.id,
      starting,
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

  const sendDisabled = sending || starting || loading || resolvingConversation
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
                Average response under 15 minutes
              </SheetDescription>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-accent/20 px-2 py-1 text-[10px] text-primary-foreground">
                Online
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

        {/* CHAT MESSAGES */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 p-4">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
          )}
          {resolvingConversation ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              {loading || status === "loading" || !hydrated ? (
                <>
                  <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
                  <p role="status" className="text-sm text-muted-foreground">Loading secure chat…</p>
                </>
              ) : (
                <Button type="button" variant="outline" onClick={() => void hydrateConversation()}>
                  Retry opening chat
                </Button>
              )}
            </div>
          ) : showGuestForm ? (
            <form
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
                disabled={sendDisabled}
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
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
                aria-label="Send message"
                size="icon"
                onClick={() => void sendMessage()}
                disabled={sendDisabled}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
