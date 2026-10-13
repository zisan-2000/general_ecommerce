import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { CHAT_ATTACHMENT_MAX_BYTES, CHAT_ATTACHMENT_MIMES, validateChatFile, type ChatFileValidationCode } from "@/lib/chat-attachments";
import { validateUpload } from "@/lib/upload-security";

export class ChatAttachmentError extends Error {
  constructor(readonly code: ChatFileValidationCode | "CHAT_UPLOAD_UNAVAILABLE", readonly status = 400) {
    super("Chat attachment request failed.");
  }
}

// Call only after ownership checks. Bound the actual stream, not just the header.
export async function readChatMessageBody(request: Request) {
  const multipart = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "multipart/form-data";
  const maxBytes = multipart ? CHAT_ATTACHMENT_MAX_BYTES + 64 * 1024 : 64 * 1024;
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ChatAttachmentError("CHAT_FILE_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ChatAttachmentError("CHAT_FILE_INVALID");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ChatAttachmentError("CHAT_FILE_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(Buffer.concat(chunks));
  try {
    if (!multipart) {
      const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new ChatAttachmentError("CHAT_FILE_INVALID");
      return { body: body as Record<string, unknown>, file: null };
    }
    const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const files = [...form.entries()].filter(([, value]) => value instanceof File);
    if (files.length !== 1 || files[0][0] !== "file") throw new ChatAttachmentError("CHAT_FILE_INVALID");
    const body: Record<string, unknown> = {};
    for (const key of ["message", "quickAction", "orderReference", "clientMessageId"]) {
      const values = form.getAll(key);
      if (values.length > 1 || (values[0] !== undefined && typeof values[0] !== "string")) throw new ChatAttachmentError("CHAT_FILE_INVALID");
      if (values.length) body[key] = values[0];
    }
    if (form.has("attachmentUrl")) throw new ChatAttachmentError("CHAT_FILE_INVALID");
    return { body, file: files[0][1] as File };
  } catch (error) {
    if (error instanceof ChatAttachmentError) throw error;
    throw new ChatAttachmentError("CHAT_FILE_INVALID");
  }
}

export async function prepareChatAttachment(file: File, conversationId: string, messageId: string) {
  const invalid = validateChatFile(file);
  if (invalid) throw new ChatAttachmentError(invalid, invalid === "CHAT_FILE_TOO_LARGE" ? 413 : 400);
  const data = Buffer.from(await file.arrayBuffer());
  const validation = validateUpload({ file, bytes: data, kind: file.type.startsWith("image/") ? "image" : "document", maxBytes: CHAT_ATTACHMENT_MAX_BYTES });
  if (!validation.ok) throw new ChatAttachmentError("CHAT_FILE_INVALID");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(conversationId)) throw new ChatAttachmentError("CHAT_FILE_INVALID");
  const extension = validation.extension.slice(1);
  if (extension === "txt" || extension === "csv") {
    try { new TextDecoder("utf-8", { fatal: true }).decode(data); }
    catch { throw new ChatAttachmentError("CHAT_FILE_INVALID"); }
    if (data.includes(0)) throw new ChatAttachmentError("CHAT_FILE_INVALID");
  }
  const hash = createHash("sha256").update(data).digest("hex");
  // Distinct attempts cannot delete a concurrent retry's successful file.
  // Original filenames are never public paths or server logs.
  const filename = `${randomUUID()}_${hash}.${extension}`;
  return {
    data, hash, extension, contentType: CHAT_ATTACHMENT_MIMES[extension],
    relPath: `chat-attachments/${conversationId}/${messageId}/${filename}`,
    url: `/api/chat/conversations/${conversationId}/attachments/${messageId}/${filename}`,
  };
}
