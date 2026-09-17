"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Clock3, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

type ChatMessage = {
  id: string;
  senderRole: string;
  message: string;
  createdAt: string;
  attachmentUrl?: string | null;
  sender?: { id: string; name?: string | null; email?: string | null } | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string" ? payload.error : "Request failed.",
    );
  }
  return payload as T;
}

interface ChatsQueryState {
  statusFilter: "ALL" | ChatStatus;
  priorityFilter: "ALL" | ChatPriority;
  assignmentFilter: "all" | "me" | "unassigned";
  selectedId: string | null;
}

const conversationsCache = new Map<string, ChatConversationListItem[]>();
const messagesCache = new Map<string, ChatMessage[]>();
let lastChatsQueryState: ChatsQueryState = {
  statusFilter: "ALL",
  priorityFilter: "ALL",
  assignmentFilter: "all",
  selectedId: null,
};

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

  const initialConversationsCacheKey = getConversationsCacheKey({
    statusFilter: lastChatsQueryState.statusFilter,
    priorityFilter: lastChatsQueryState.priorityFilter,
    assignmentFilter: lastChatsQueryState.assignmentFilter,
  });
  const initialConversations =
    conversationsCache.get(initialConversationsCacheKey) ?? [];

  const [conversations, setConversations] = useState<
    ChatConversationListItem[]
  >(() => initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    lastChatsQueryState.selectedId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    () =>
      (lastChatsQueryState.selectedId
        ? messagesCache.get(lastChatsQueryState.selectedId)
        : undefined) ?? [],
  );
  const [draft, setDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ChatStatus>(
    lastChatsQueryState.statusFilter,
  );
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ChatPriority>(
    lastChatsQueryState.priorityFilter,
  );
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "me" | "unassigned"
  >(lastChatsQueryState.assignmentFilter);
  const [loadingList, setLoadingList] = useState(
    () => initialConversations.length === 0,
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const loadConversations = useCallback(
    async (silent = true, force = false) => {
      const cacheKey = getConversationsCacheKey({
        statusFilter,
        priorityFilter,
        assignmentFilter,
      });

      if (!force && !silent) {
        const cached = conversationsCache.get(cacheKey);
        if (cached) {
          setConversations(cached);
          setSelectedId((prev) => {
            if (!prev && cached.length > 0) return cached[0].id;
            if (prev && !cached.some((item) => item.id === prev)) {
              return cached[0]?.id ?? null;
            }
            return prev;
          });
          setLoadingList(false);
          return;
        }
      }

      if (!silent) setLoadingList(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "100");
        params.set("assignedTo", assignmentFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);

        const list = await fetchJson<ChatConversationListItem[]>(
          `/api/chat/conversations?${params.toString()}`,
        );

        conversationsCache.set(cacheKey, list);
        setConversations(list);
        setSelectedId((prev) => {
          if (!prev && list.length > 0) return list[0].id;
          if (prev && !list.some((item) => item.id === prev))
            return list[0]?.id ?? null;
          return prev;
        });
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : t("errors.loadChats"),
        );
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignmentFilter, priorityFilter, statusFilter],
  );

  const loadMessages = useCallback(
    async (conversationId: string, silent = true) => {
      if (!silent) {
        const cached = messagesCache.get(conversationId);
        if (cached) {
          setMessages(cached);
          setLoadingMessages(false);
          return;
        }
      }

      if (!silent) setLoadingMessages(true);
      try {
        const data = await fetchJson<{
          messages: ChatMessage[];
          conversation: ChatConversationListItem;
        }>(
          `/api/chat/conversations/${conversationId}/messages?limit=200&markRead=true`,
        );

        messagesCache.set(conversationId, data.messages);
        setMessages(data.messages);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : t("errors.loadMessages"),
        );
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void loadConversations(false);
  }, [loadConversations]);

  useEffect(() => {
    lastChatsQueryState = {
      statusFilter,
      priorityFilter,
      assignmentFilter,
      selectedId,
    };
  }, [assignmentFilter, priorityFilter, selectedId, statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId, false);
  }, [loadMessages, selectedId]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadConversations(true);
      if (selectedId) void loadMessages(selectedId, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedId]);

  const updateConversation = useCallback(
    async (
      payload: Partial<{
        status: ChatStatus;
        priority: ChatPriority;
        assignedToId: string | null;
      }>,
    ) => {
      if (!selectedId) return;
      setSaving(true);
      try {
        await fetchJson(`/api/chat/conversations/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        conversationsCache.clear();
        await loadConversations(true, true);
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : t("errors.updateConversation"),
        );
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadConversations, selectedId],
  );

  const sendReply = useCallback(async () => {
    const text = draft.trim();
    if (!selectedId || !text) return;

    setSaving(true);
    try {
      await fetchJson(`/api/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      setDraft("");
      messagesCache.delete(selectedId);
      conversationsCache.clear();
      await loadMessages(selectedId, true);
      await loadConversations(true, true);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : t("errors.sendReply"),
      );
    } finally {
      setSaving(false);
    }
  }, [draft, loadConversations, loadMessages, selectedId, t]);

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

      {error ? (
        <Card className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
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
          onClick={() => void loadConversations(false, true)}
          disabled={loadingList}
        >
          {t("actions.refresh")}
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-[72vh] overflow-hidden">
          <div className="border-b p-3 text-sm font-semibold text-foreground">
            {t("conversations.title", { count: conversations.length })}
          </div>
          <div className="h-[calc(72vh-52px)] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t("conversations.empty")}
              </p>
            ) : (
              conversations.map((item) => (
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
                {loadingMessages && messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("thread.loadingMessages")}
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("thread.noMessages")}
                  </p>
                ) : (
                  messages.map((message) => {
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
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder={t("thread.replyPlaceholder")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => void sendReply()}
                    disabled={saving || !draft.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
