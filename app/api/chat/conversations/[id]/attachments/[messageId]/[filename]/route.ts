import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { canAccessConversation, getChatActor } from "@/lib/chat";
import { chatJson, readGuestChatSession, rejectUnownedGuestChat } from "@/lib/chat-guest-session";
import { CHAT_ATTACHMENT_MIMES, parseChatAttachmentUrl } from "@/lib/chat-attachments";
import { readUpload } from "@/lib/upload-storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: {
  params: Promise<{ id: string; messageId: string; filename: string }>;
}) {
  try {
    const { id, messageId, filename } = await params;
    const url = `/api/chat/conversations/${id}/attachments/${messageId}/${filename}`;
    const attachment = parseChatAttachmentUrl(url);
    if (!attachment) return chatJson({ error: "Attachment not found." }, { status: 404 });
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(session?.user);
    const actor = getChatActor(session?.user, { canManageChats: access.has("chats.manage") });
    const guest = actor.userId || actor.isAdmin ? null : await readGuestChatSession(request);
    const unowned = rejectUnownedGuestChat(actor, guest, id);
    if (unowned) return unowned;
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { conversationId: true, attachmentUrl: true, conversation: { select: { id: true, userId: true } } },
    });
    if (!message || message.conversationId !== id || message.attachmentUrl !== url) {
      return chatJson({ error: "Attachment not found." }, { status: 404 });
    }
    if (!canAccessConversation(message.conversation, actor, guest)) return chatJson({ error: "Forbidden." }, { status: 403 });
    const stored = await readUpload(`chat-attachments/${id}/${messageId}/${filename}`);
    if (!stored) return chatJson({ error: "Attachment not found." }, { status: 404 });
    const preview = attachment.isImage && request.nextUrl.searchParams.get("preview") === "1";
    return new NextResponse(stored.body, { headers: {
      "Content-Type": CHAT_ATTACHMENT_MIMES[attachment.extension],
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="chat-attachment.${attachment.extension}"`,
      "Cache-Control": "private, no-store", "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin", "Referrer-Policy": "no-referrer",
    } });
  } catch {
    console.warn("Support chat attachment could not be retrieved.");
    return chatJson({ error: "Attachment could not be retrieved." }, { status: 503 });
  }
}
