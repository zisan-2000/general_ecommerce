import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import type { ChatStatus } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { canAccessConversation, getChatActor } from "@/lib/chat";
import { getAccessContext } from "@/lib/rbac";
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
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

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

    const messagesDescending = await prisma.chatMessage.findMany({
      where: { conversationId: id },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    const messages = [...messagesDescending].reverse();

    if (markRead) {
      await prisma.chatMessage.updateMany({
        where: {
          conversationId: id,
          isRead: false,
          senderRole: actor.isAdmin ? { not: "admin" } : "admin",
        },
        data: { isRead: true },
      });
    }

    return chatJson({ conversation, messages });
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

    const composed = composeMessage(message, quickAction, orderReference);
    if (!composed && !attachmentUrl) {
      return chatJson({ error: "Message cannot be empty." }, { status: 400 });
    }

    const nextStatus =
      actor.isAdmin || conversation.status === "CLOSED" ? "IN_PROGRESS" : conversation.status;
    const statusToSet = CHAT_STATUSES.includes(nextStatus as ChatStatus)
      ? (nextStatus as ChatStatus)
      : "IN_PROGRESS";

    const createdMessage = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
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
    });

    return chatJson(createdMessage, { status: 201 });
  } catch (error) {
    console.error("CHAT MESSAGES POST ERROR:", error);
    return chatJson({ error: "Failed to send message." }, { status: 500 });
  }
}
