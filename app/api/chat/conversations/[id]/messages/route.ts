import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma, type ChatStatus } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { canAccessConversation, getChatActor } from "@/lib/chat";
import { getAccessContext } from "@/lib/rbac";
import { publishChatChange } from "@/lib/pusher-server";
import {
  chatJson,
  readGuestChatSession,
  rejectUnownedGuestChat,
  rejectUnsafeChatMutation,
} from "@/lib/chat-guest-session";

const CHAT_STATUSES: ChatStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];

function toCleanText(value: unknown, max = 4000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function composeMessage(
  message: string,
  quickAction: string,
  orderReference: string,
): string {
  const tags: string[] = [];
  if (quickAction) tags.push(`Topic: ${quickAction}`);
  if (orderReference) tags.push(`Order: ${orderReference}`);
  const prefix = tags.length > 0 ? `[${tags.join(" | ")}] ` : "";
  return `${prefix}${message}`.trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    const actor = getChatActor(
      session?.user as { id?: string; role?: string } | undefined,
      { canManageChats: access.has("chats.manage") },
    );

    const { searchParams } = new URL(request.url);
    const guestSession = actor.userId || actor.isAdmin ? null : await readGuestChatSession(request);
    const unownedGuest = rejectUnownedGuestChat(actor, guestSession, id);
    if (unownedGuest) return unownedGuest;
    const markRead = searchParams.get("markRead") !== "false";
    const limitRaw = Number(searchParams.get("limit") || "100");
    const limit = Number.isFinite(limitRaw) ? Math.floor(Math.min(Math.max(limitRaw, 1), 200)) : 100;

    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    if (!conversation) {
      return chatJson({ error: "Conversation not found." }, { status: 404 });
    }

    if (!canAccessConversation(conversation, actor, guestSession)) {
      return chatJson({ error: "Forbidden." }, { status: 403 });
    }

    // Ordered incremental catch-up avoids losing messages after a long disconnect.
    const afterId = searchParams.get("afterId");
    const anchor = afterId ? await prisma.chatMessage.findUnique({
      where: { id: afterId }, select: { conversationId: true, createdAt: true, id: true },
    }) : null;
    if (afterId && (!anchor || anchor.conversationId !== id)) {
      return chatJson({ error: "Invalid message cursor." }, { status: 400 });
    }
    const rows = await prisma.chatMessage.findMany({
      where: {
        conversationId: id,
        ...(anchor ? { OR: [
          { createdAt: { gt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { gt: anchor.id } },
        ] } : {}),
      },
      take: limit + 1,
      orderBy: [{ createdAt: anchor ? "asc" : "desc" }, { id: anchor ? "asc" : "desc" }],
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const messages = anchor ? page : page.reverse();

    if (markRead) {
      const read = await prisma.chatMessage.updateMany({
        where: {
          conversationId: id,
          isRead: false,
          senderRole: actor.isAdmin ? { not: "admin" } : "admin",
          // Only messages actually returned to this reader are confirmed read.
          id: { in: messages.map((message) => message.id) },
        },
        data: { isRead: true },
      });
      if (read.count > 0) await publishChatChange({ conversationId: id, kind: "read" });
    }

    return chatJson({ conversation, messages, hasMore, nextCursor: messages.at(-1)?.id ?? afterId ?? null });
  } catch (error) {
    console.error("CHAT MESSAGES GET ERROR:", error);
    return chatJson({ error: "Failed to load messages." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const unsafeRequest = rejectUnsafeChatMutation(request);
    if (unsafeRequest) return unsafeRequest;
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    const actor = getChatActor(
      session?.user as { id?: string; role?: string } | undefined,
      { canManageChats: access.has("chats.manage") },
    );
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return chatJson({ error: "Invalid chat request." }, { status: 400 });
    }

    const guestSession = actor.userId || actor.isAdmin ? null : await readGuestChatSession(request);
    const unownedGuest = rejectUnownedGuestChat(actor, guestSession, id);
    if (unownedGuest) return unownedGuest;
    const message = toCleanText(body.message);
    const quickAction = toCleanText(body.quickAction, 80);
    const orderReference = toCleanText(body.orderReference, 60);
    const attachmentUrl = toCleanText(body.attachmentUrl, 2000);

    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      select: { id: true, userId: true, guestEmail: true, status: true },
    });

    if (!conversation) {
      return chatJson({ error: "Conversation not found." }, { status: 404 });
    }

    if (!canAccessConversation(conversation, actor, guestSession)) {
      return chatJson({ error: "Forbidden." }, { status: 403 });
    }

    if (typeof body.message !== "string" && body.message !== undefined) {
      return chatJson({ error: "Message must be text." }, { status: 400 });
    }
    if (typeof body.message === "string" && body.message.trim().length > 4000) {
      return chatJson({ error: "Message is too long.", code: "MESSAGE_TOO_LONG" }, { status: 400 });
    }
    const clientMessageId = typeof body.clientMessageId === "string" ? body.clientMessageId.toLowerCase() : null;
    if (body.clientMessageId !== undefined && (!clientMessageId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clientMessageId))) {
      return chatJson({ error: "Invalid message identifier.", code: "INVALID_MESSAGE_ID" }, { status: 400 });
    }
    const composed = composeMessage(message, quickAction, orderReference);
    if (!composed && !attachmentUrl) {
      return chatJson({ error: "Message cannot be empty.", code: "MESSAGE_EMPTY" }, { status: 400 });
    }

    // Ownership is checked before looking up an idempotency ID. The ID is not an
    // access credential, and retries must match the original actor and payload.
    const replayMessage = async () => {
      if (!clientMessageId) return null;
      const existing = await prisma.chatMessage.findUnique({
        where: { id: clientMessageId },
        include: { sender: { select: { id: true, name: true, email: true } } },
      });
      if (!existing) return null;
      if (existing.conversationId !== id || existing.senderId !== actor.userId
        || existing.senderRole !== actor.senderRole || existing.message !== (composed || "Attachment")
        || existing.attachmentUrl !== (attachmentUrl || null)) {
        return chatJson({ error: "Message identifier conflict.", code: "MESSAGE_ID_CONFLICT" }, { status: 409 });
      }
      await publishChatChange({ conversationId: id, kind: "message", messageId: existing.id });
      return chatJson(existing);
    };
    const replay = await replayMessage();
    if (replay) return replay;

    const nextStatus =
      actor.isAdmin || conversation.status === "CLOSED" ? "IN_PROGRESS" : conversation.status;
    const statusToSet = CHAT_STATUSES.includes(nextStatus as ChatStatus)
      ? (nextStatus as ChatStatus)
      : "IN_PROGRESS";

    const createMessage = () => prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          ...(clientMessageId ? { id: clientMessageId } : {}),
          conversationId: id,
          senderId: actor.userId,
          senderRole: actor.senderRole,
          message: composed || "Attachment",
          attachmentUrl: attachmentUrl || null,
        },
        include: {
          sender: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.chatConversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          closedAt: null,
          status: actor.isAdmin ? "IN_PROGRESS" : statusToSet,
        },
      });

      return created;
    });
    const createdMessage = await createMessage().catch(async (error: unknown) => {
      // Concurrent retries race on the existing primary key. The losing
      // transaction rolls back; return the committed original instead.
      if (clientMessageId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrentReplay = await replayMessage();
        if (concurrentReplay) return concurrentReplay;
      }
      throw error;
    });
    if (createdMessage instanceof Response) return createdMessage;

    await publishChatChange({ conversationId: id, kind: "message", messageId: createdMessage.id });

    await logActivity({
      action: actor.isAdmin ? "send_chat_reply" : "send_chat_message",
      entity: "chat",
      entityId: id,
      access,
      request,
      metadata: {
        message: actor.isAdmin
          ? `Admin replied to chat ${id}`
          : `Customer sent message in chat ${id}`,
        attachment: Boolean(attachmentUrl),
      },
      after: {
        conversationId: id,
        messageId: createdMessage.id,
        senderId: createdMessage.senderId,
        senderRole: createdMessage.senderRole,
        attachmentUrl: createdMessage.attachmentUrl,
      },
    }).catch(() => console.warn("Support chat message saved; activity logging failed."));

    return chatJson(createdMessage, { status: 201 });
  } catch (error) {
    console.error("CHAT MESSAGES POST ERROR:", error);
    return chatJson({ error: "Failed to send message." }, { status: 500 });
  }
}
