"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Clock3, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AgentAvailabilityControl from "@/components/chat/AgentAvailabilityControl";
import { useSupportChatRealtime } from "@/hooks/use-support-chat-realtime";
import { CHAT_CONNECTION_LABELS } from "@/lib/chat-realtime";
import {
  type ChatMessage as BaseChatMessage, ChatRequestError, createChatMessageId,
  describeChatError, fetchChatJson, isChatConversationList, isChatMessage,
  mergeChatMessages, synchronizeChatMessages,
} from "@/lib/chat-client";

type ChatStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
type ChatPriority = "LOW" | "NORMAL" | "HIGH";

type ChatConversationListItem = {
  id: string;
  status: ChatStatus;
  priority: ChatPriority;
  guestEmail?: string | null;
  guestName?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  user?: { id: string; name?: string | null; email?: string | null } | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  lastMessage?: {
    id: string;
    message: string;
    createdAt: string;
    senderRole: string;
  } | null;
  _count: { messages: number };
};

type ChatMessage = BaseChatMessage & {
  sender?: { id: string; name?: string | null; email?: string | null } | null;
};

interface ChatsQueryState {
  statusFilter: "ALL" | ChatStatus;
  priorityFilter: "ALL" | ChatPriority;
  assignmentFilter: "all" | "me" | "unassigned";
  selectedId: string | null;
}

const getConversationsCacheKey = (query: Omit<ChatsQueryState, "selectedId">) =>
  JSON.stringify({
    limit: 100,
    assignedTo: query.assignmentFilter,
    status: query.statusFilter,
    priority: query.priorityFilter,
  });

export default function AdminChatsPage() {
  const t = useTranslations("AdminChatsPage");

  const { data: session } = useSession();
  const adminId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const labelForStatus = useCallback(
    (status: ChatStatus): string => t(`statuses.${status}`),
    [t],
  );

  const [conversations, setConversations] = useState<
    ChatConversationListItem[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ChatStatus>(
    "ALL",
  );
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ChatPriority>(
    "ALL",
  );
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "me" | "unassigned"
  >("all");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewIdentity, setViewIdentity] = useState<string | null>(null);
  const [messageConversationId, setMessageConversationId] = useState<string | null>(null);
  const epochRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const listSequence = useRef(0);
  const messageSequence = useRef(0);
  const mutationRef = useRef<number | null>(null);
  const messagesCache = useRef(new Map<string, ChatMessage[]>());
  const draftCache = useRef(new Map<string, string>());
  const pendingReplies = useRef(new Map<string, { id: string; text: string; originalDraft: string }>());
  const messageRequest = useRef<{ id: string; epoch: number; sequence: number; promise: Promise<boolean> } | null>(null);
  const queryKey = getConversationsCacheKey({ statusFilter, priorityFilter, assignmentFilter });
  const queryRef = useRef(queryKey);

  const handleFailure = useCallback((failure: unknown, operation: "read" | "send" | "close") => {
    setError(describeChatError(failure, operation, false).message);
    if (failure instanceof ChatRequestError && [401, 403].includes(failure.status ?? 0)) {
      epochRef.current += 1;
      messagesCache.current.clear();
      draftCache.current.clear();
      pendingReplies.current.clear();
      mutationRef.current = null;
      messageRequest.current = null;
      setSaving(false);
      setSendingReply(false);
      setLoadingMessages(false);
      setLoadingList(false);
      setMessages([]);
      setConversations([]);
      setSelectedId(null);
      setViewIdentity(null);
    }
  }, []);

  useEffect(() => {
    epochRef.current += 1;
    messagesCache.current.clear();
    draftCache.current.clear();
    pendingReplies.current.clear();
    mutationRef.current = null;
    messageRequest.current = null;
    selectedRef.current = null;
    setConversations([]);
    setMessages([]);
    setSelectedId(null);
    setMessageConversationId(null);
    setDraft("");
    setError(null);
    setSaving(false);
    setSendingReply(false);
    setViewIdentity(adminId);
    return () => { epochRef.current += 1; };
  }, [adminId]);

  useEffect(() => { queryRef.current = queryKey; }, [queryKey]);

  const selectedConversation = useMemo(
    () => viewIdentity === adminId ? conversations.find((item) => item.id === selectedId) ?? null : null,
    [adminId, conversations, selectedId, viewIdentity],
  );

  const loadConversations = useCallback(
    async (silent = true) => {
      if (!adminId) return false;
      // Always request current DB state. Component-local message caches are only
      // for thread history, never a substitute for list revalidation.
      const epoch = epochRef.current;
      const sequence = ++listSequence.current;
      const cacheKey = getConversationsCacheKey({
        statusFilter,
        priorityFilter,
        assignmentFilter,
      });

      if (!silent) setLoadingList(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "100");
        params.set("assignedTo", assignmentFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);

        const list = await fetchChatJson<ChatConversationListItem[]>(
          `/api/chat/conversations?${params.toString()}`,
          undefined,
          (value): value is ChatConversationListItem[] => isChatConversationList(value)
            && value.every((item) => "_count" in item && !!item._count && typeof item._count === "object"
              && "messages" in item._count && typeof item._count.messages === "number"),
        );
        if (epoch !== epochRef.current || sequence !== listSequence.current || cacheKey !== queryRef.current) return false;
        setConversations(list);
        setSelectedId((prev) => {
          if (!prev && list.length > 0) return list[0].id;
          if (prev && !list.some((item) => item.id === prev))
            return list[0]?.id ?? null;
          return prev;
        });
        setError((current) => current?.startsWith("We could not refresh") ? null : current);
        return true;
      } catch (fetchError) {
        if (epoch === epochRef.current && sequence === listSequence.current) handleFailure(fetchError, "read");
        return false;
      } finally {
        if (epoch === epochRef.current && sequence === listSequence.current) setLoadingList(false);
      }
    },
    [adminId, assignmentFilter, handleFailure, priorityFilter, statusFilter],
  );

  const loadMessages = useCallback(
    (conversationId: string, silent = true): Promise<boolean> => {
      const epoch = epochRef.current;
      if (messageRequest.current?.id === conversationId && messageRequest.current.epoch === epoch) {
        return messageRequest.current.promise;
      }
      const sequence = ++messageSequence.current;
      const isCurrent = () => epoch === epochRef.current && sequence === messageSequence.current
        && selectedRef.current === conversationId;
      if (!silent) setLoadingMessages(true);
      const promise = (async () => {
        try {
          await synchronizeChatMessages(conversationId, messagesCache.current.get(conversationId) ?? [], (page) => {
            const merged = mergeChatMessages(messagesCache.current.get(conversationId) ?? [], page.messages);
            messagesCache.current.set(conversationId, merged);
            setMessages((current) => mergeChatMessages(
              current.filter((message) => message.conversationId === conversationId), page.messages,
            ));
            setMessageConversationId(conversationId);
            const pending = pendingReplies.current.get(conversationId);
            if (pending && mutationRef.current === null && merged.some((message) => message.id === pending.id)) {
              pendingReplies.current.delete(conversationId);
              setDraft((current) => current === pending.originalDraft ? "" : current);
              if (draftCache.current.get(conversationId) === pending.originalDraft) draftCache.current.delete(conversationId);
              setError(null);
            }
          }, isCurrent);
          return isCurrent();
        } catch (fetchError) {
          if (isCurrent()) handleFailure(fetchError, "read");
          return false;
        } finally {
          if (messageRequest.current?.sequence === sequence) messageRequest.current = null;
          if (isCurrent()) setLoadingMessages(false);
        }
      })();
      messageRequest.current = { id: conversationId, epoch, sequence, promise };
      return promise;
    },
    [handleFailure],
  );

  useEffect(() => {
    void loadConversations(false);
  }, [loadConversations]);

  useEffect(() => {
    selectedRef.current = selectedId;
    messageSequence.current += 1;
    messageRequest.current = null;
    setMessages(selectedId ? messagesCache.current.get(selectedId) ?? [] : []);
    setMessageConversationId(selectedId);
    setDraft(selectedId ? draftCache.current.get(selectedId) ?? "" : "");
    setLoadingMessages(false);
    if (!selectedId) return;
    void loadMessages(selectedId, false);
  }, [loadMessages, selectedId]);

  const { connectionStatus, remoteTyping, notifyTyping, requestSynchronize } = useSupportChatRealtime({
    enabled: Boolean(adminId && viewIdentity === adminId), identity: adminId ?? "signed-out",
    conversationId: selectedId, admin: true,
    onSynchronize: async () => {
      if (mutationRef.current !== null) return false;
      const results = await Promise.all([
        loadConversations(true),
        selectedId ? loadMessages(selectedId, true) : Promise.resolve(true),
      ]);
      return results.every(Boolean);
    },
    onAccessError: (failure) => handleFailure(failure, "read"),
  });

  const updateConversation = useCallback(
    async (
      payload: Partial<{
        status: ChatStatus;
        priority: ChatPriority;
        assignedToId: string | null;
      }>,
    ) => {
      if (!selectedId || mutationRef.current !== null) return;
      const epoch = epochRef.current;
      mutationRef.current = epoch;
      setSaving(true);
      try {
        await fetchChatJson(`/api/chat/conversations/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (epoch !== epochRef.current) return;
        setError(null);
        await loadConversations(true);
      } catch (updateError) {
        if (epoch === epochRef.current) handleFailure(updateError, "close");
      } finally {
        if (mutationRef.current === epoch) mutationRef.current = null;
        if (epoch === epochRef.current) setSaving(false);
        requestSynchronize();
      }
    },
    [handleFailure, loadConversations, requestSynchronize, selectedId],
  );

  const sendReply = useCallback(async () => {
    const text = draft.trim();
    if (!selectedId || !text || mutationRef.current !== null) return;
    if (text.length > 4000) {
      handleFailure(new ChatRequestError("validation", 400, "MESSAGE_TOO_LONG"), "send");
      return;
    }
    const epoch = epochRef.current;
    const conversationId = selectedId;
    mutationRef.current = epoch;
    messageSequence.current += 1;
    messageRequest.current = null;
    notifyTyping(false);
    setSaving(true);
    setSendingReply(true);
    try {
      const previous = pendingReplies.current.get(conversationId);
      const pending = previous?.text === text ? previous
        : { id: createChatMessageId(), text, originalDraft: draft };
      pendingReplies.current.set(conversationId, pending);
      const created = await fetchChatJson<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: pending.text, clientMessageId: pending.id }),
      }, isChatMessage);
      if (created.id !== pending.id || created.conversationId !== conversationId) throw new ChatRequestError("unexpected");
      if (epoch !== epochRef.current) return;
      pendingReplies.current.delete(conversationId);
      if (draftCache.current.get(conversationId) === pending.originalDraft) draftCache.current.delete(conversationId);
      if (selectedRef.current === conversationId) {
        setDraft((current) => current === pending.originalDraft ? "" : current);
        setMessages((current) => mergeChatMessages(current, [created]));
      }
      setError(null);
      if (selectedRef.current === conversationId) await loadMessages(conversationId, true);
      await loadConversations(true);
    } catch (sendError) {
      if (epoch === epochRef.current) handleFailure(sendError, "send");
    } finally {
      if (mutationRef.current === epoch) mutationRef.current = null;
      if (epoch === epochRef.current) setSaving(false);
      if (epoch === epochRef.current) setSendingReply(false);
      requestSynchronize();
    }
  }, [draft, handleFailure, loadConversations, loadMessages, notifyTyping, requestSynchronize, selectedId]);

  const visibleConversations = viewIdentity === adminId ? conversations : [];
  const visibleMessages = viewIdentity === adminId && messageConversationId === selectedId ? messages : [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("header.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("header.description")}
        </p>
      </div>

      <AgentAvailabilityControl key={adminId ?? "signed-out"} userId={adminId} />
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {CHAT_CONNECTION_LABELS[adminId && viewIdentity === adminId ? connectionStatus : "denied"]}
      </p>

      {error ? (
        <Card role="alert" className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <Button className="ml-3" size="sm" variant="outline" disabled={saving}
            onClick={() => { requestSynchronize(); void loadConversations(false); }}>
            Refresh chat
          </Button>
        </Card>
      ) : null}

      <Card className="grid gap-3 p-3 md:grid-cols-4">
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "ALL" | ChatStatus)
          }
        >
          <option value="ALL">{t("filters.allStatus")}</option>
          <option value="OPEN">{t("statuses.OPEN")}</option>
          <option value="IN_PROGRESS">{t("statuses.IN_PROGRESS")}</option>
          <option value="CLOSED">{t("statuses.CLOSED")}</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={priorityFilter}
          onChange={(event) =>
            setPriorityFilter(event.target.value as "ALL" | ChatPriority)
          }
        >
          <option value="ALL">{t("filters.allPriority")}</option>
          <option value="LOW">{t("priorities.LOW")}</option>
          <option value="NORMAL">{t("priorities.NORMAL")}</option>
          <option value="HIGH">{t("priorities.HIGH")}</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={assignmentFilter}
          onChange={(event) =>
            setAssignmentFilter(
              event.target.value as "all" | "me" | "unassigned",
            )
          }
        >
          <option value="all">{t("filters.allAssignees")}</option>
          <option value="me">{t("filters.assignedToMe")}</option>
          <option value="unassigned">{t("filters.unassigned")}</option>
        </select>
        <Button
          onClick={() => void loadConversations(false)}
          disabled={loadingList}
        >
          {t("actions.refresh")}
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-[72vh] overflow-hidden">
          <div className="border-b p-3 text-sm font-semibold text-foreground">
            {t("conversations.title", { count: visibleConversations.length })}
          </div>
          <div className="h-[calc(72vh-52px)] overflow-y-auto">
            {visibleConversations.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t("conversations.empty")}
              </p>
            ) : (
              visibleConversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full border-b p-3 text-left transition hover:bg-accent ${
                    selectedId === item.id ? "bg-accent/70" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.user?.name ||
                        item.guestName ||
                        item.user?.email ||
                        item.guestEmail ||
                        t("conversations.customer")}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                      {labelForStatus(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {item.lastMessage?.message || t("conversations.noMessages")}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {t("conversations.priorityLabel", {
                        priority: t(`priorities.${item.priority}`),
                      })}
                    </span>
                    <span>
                      {t("conversations.messagesCount", {
                        count: item._count.messages,
                      })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="h-[72vh] overflow-hidden">
          {!selectedConversation ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("thread.selectHint")}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {selectedConversation.user?.name ||
                      selectedConversation.guestName ||
                      selectedConversation.user?.email ||
                      selectedConversation.guestEmail}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px]">
                    {labelForStatus(selectedConversation.status)}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px]">
                    {t(`priorities.${selectedConversation.priority}`)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={selectedConversation.status}
                    onChange={(event) =>
                      void updateConversation({
                        status: event.target.value as ChatStatus,
                      })
                    }
                    disabled={saving}
                  >
                    <option value="OPEN">{t("statuses.OPEN")}</option>
                    <option value="IN_PROGRESS">
                      {t("statuses.IN_PROGRESS")}
                    </option>
                    <option value="CLOSED">{t("statuses.CLOSED")}</option>
                  </select>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={selectedConversation.priority}
                    onChange={(event) =>
                      void updateConversation({
                        priority: event.target.value as ChatPriority,
                      })
                    }
                    disabled={saving}
                  >
                    <option value="LOW">{t("priorities.LOW")}</option>
                    <option value="NORMAL">{t("priorities.NORMAL")}</option>
                    <option value="HIGH">{t("priorities.HIGH")}</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!adminId || saving}
                    onClick={() =>
                      void updateConversation({ assignedToId: adminId })
                    }
                  >
                    {t("actions.assignToMe")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void updateConversation({ assignedToId: null })
                    }
                  >
                    {t("actions.unassign")}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("thread.assignedLabel", {
                    name:
                      selectedConversation.assignedTo?.name ||
                      selectedConversation.assignedTo?.email ||
                      t("thread.unassigned"),
                  })}
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted p-4">
                {loadingMessages && visibleMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("thread.loadingMessages")}
                  </p>
                ) : visibleMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("thread.noMessages")}
                  </p>
                ) : (
                  visibleMessages.map((message) => {
                    const mine = message.senderRole === "admin";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-card-foreground border border-border"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">
                            {message.message}
                          </p>
                          {message.attachmentUrl ? (
                            <a
                              href={message.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`mt-1 block text-xs underline ${
                                mine
                                  ? "text-primary-foreground/80"
                                  : "text-primary"
                              }`}
                            >
                              {t("thread.viewAttachment")}
                            </a>
                          ) : null}
                          <p
                            className={`mt-1 text-[11px] ${
                              mine
                                ? "text-primary-foreground/75"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Clock3 className="mr-1 inline h-3 w-3" />
                            {new Date(message.createdAt).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                            {mine ? ` · ${message.isRead ? "Read" : "Sent"}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t p-3">
                {remoteTyping && <p role="status" aria-live="polite" className="mb-2 text-xs text-muted-foreground">Customer is typing…</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    disabled={saving || loadingMessages}
                    aria-label={t("thread.replyPlaceholder")}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (selectedId) draftCache.current.set(selectedId, event.target.value);
                      notifyTyping(Boolean(event.target.value.trim()));
                    }}
                    onBlur={() => notifyTyping(false)}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder={t("thread.replyPlaceholder")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        if (event.nativeEvent.isComposing) return;
                        event.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => void sendReply()}
                    aria-label={sendingReply ? "Sending reply" : "Send reply"}
                    disabled={saving || loadingMessages || !draft.trim()}
                  >
                    {sendingReply ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
                  </Button>
                </div>
                <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
                  {sendingReply ? "Sending reply…" : saving ? "Saving chat change…" : "Enter to send · Shift+Enter for a new line"}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
