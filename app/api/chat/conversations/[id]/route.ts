import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import type { ChatPriority, ChatStatus, Prisma } from "@/generated/prisma";
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
const CHAT_PRIORITIES: ChatPriority[] = ["LOW", "NORMAL", "HIGH"];

function toCleanText(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function buildFeedbackMessage(rating: number | null, feedback: string): string {
  const lines: string[] = [];
  if (rating !== null) lines.push(`CSAT rating: ${rating}/5`);
  if (feedback) lines.push(`Feedback: ${feedback}`);
  return lines.join("\n").trim();
}

function toConversationLogSnapshot(conversation: any) {
  return {
    id: conversation.id,
    userId: conversation.userId ?? null,
    guestEmail: conversation.guestEmail ?? null,
    status: conversation.status,
    priority: conversation.priority,
    assignedToId: conversation.assignedToId ?? null,
    closedAt: conversation.closedAt?.toISOString?.() ?? conversation.closedAt ?? null,
  };
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
    const guestSession = actor.userId || actor.isAdmin ? null : await readGuestChatSession(request);
    const unownedGuest = rejectUnownedGuestChat(actor, guestSession, id);
    if (unownedGuest) return unownedGuest;

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

    return chatJson(conversation);
  } catch (error) {
    console.error("CHAT CONVERSATION GET ERROR:", error);
    return chatJson({ error: "Failed to load conversation." }, { status: 500 });
  }
}

export async function PATCH(
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
    const requestedStatus = typeof body.status === "string" ? body.status : null;
    const requestedPriority = typeof body.priority === "string" ? body.priority : null;
    const requestedAssignedToId =
      typeof body.assignedToId === "string" ? body.assignedToId.trim() : body.assignedToId;
    const feedback = toCleanText(body.feedback, 1000);
    const ratingRaw = Number(body.rating);
    const rating =
      Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : null;

    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        status: true,
        priority: true,
        assignedToId: true,
        closedAt: true,
      },
    });

    if (!conversation) {
      return chatJson({ error: "Conversation not found." }, { status: 404 });
    }

    if (!canAccessConversation(conversation, actor, guestSession)) {
      return chatJson({ error: "Forbidden." }, { status: 403 });
    }

    const updateData: Prisma.ChatConversationUpdateInput = {};

    if (actor.isAdmin) {
      if (requestedStatus && CHAT_STATUSES.includes(requestedStatus as ChatStatus)) {
        updateData.status = requestedStatus as ChatStatus;
        updateData.closedAt = requestedStatus === "CLOSED" ? new Date() : null;
      }

      if (requestedPriority && CHAT_PRIORITIES.includes(requestedPriority as ChatPriority)) {
        updateData.priority = requestedPriority as ChatPriority;
      }

      if (requestedAssignedToId !== undefined) {
        if (requestedAssignedToId === null || requestedAssignedToId === "") {
          updateData.assignedTo = { disconnect: true };
        } else if (typeof requestedAssignedToId === "string") {
          const user = await prisma.user.findUnique({
            where: { id: requestedAssignedToId },
            select: { id: true },
          });
          if (!user) {
            return chatJson({ error: "Assigned user not found." }, { status: 400 });
          }
          updateData.assignedTo = { connect: { id: requestedAssignedToId } };
        }
      }
    } else {
      if (requestedStatus && requestedStatus !== "CLOSED") {
        return chatJson(
          { error: "Only closing chat is allowed for customers." },
          { status: 403 },
        );
      }
      if (requestedStatus === "CLOSED" || feedback || rating !== null) {
        updateData.status = "CLOSED";
        updateData.closedAt = new Date();
      }
    }

    const feedbackMessage = buildFeedbackMessage(rating, feedback);

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.chatConversation.update({
          where: { id },
          data: updateData,
        });
      }

      if (feedbackMessage) {
        await tx.chatMessage.create({
          data: {
            conversationId: id,
            senderId: actor.userId,
            senderRole: actor.senderRole,
            message: feedbackMessage,
          },
        });
        await tx.chatConversation.update({
          where: { id },
          data: {
            lastMessageAt: new Date(),
          },
        });
      }

      return tx.chatConversation.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });
    });

    if (updated && (Object.keys(updateData).length > 0 || feedbackMessage)) {
      await publishChatChange({ conversationId: id, kind: "updated" });
      const action =
        requestedStatus === "CLOSED"
          ? "close_chat_conversation"
          : feedbackMessage
            ? "update_chat_feedback"
            : "update_chat_conversation";
      await logActivity({
        action,
        entity: "chat",
        entityId: updated.id,
        access,
        request,
        metadata: {
          message:
            requestedStatus === "CLOSED"
              ? `Chat conversation closed: ${updated.id}`
              : feedbackMessage
                ? `Chat feedback submitted for conversation ${updated.id}`
                : `Chat conversation updated: ${updated.id}`,
        },
        before: toConversationLogSnapshot(conversation),
        after: toConversationLogSnapshot(updated),
      }).catch(() => console.warn("Support chat update saved; activity logging failed."));
    }

    return chatJson(updated);
  } catch (error) {
    console.error("CHAT CONVERSATION PATCH ERROR:", error);
    return chatJson({ error: "Failed to update conversation." }, { status: 500 });
  }
}
