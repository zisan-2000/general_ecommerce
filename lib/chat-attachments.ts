// Browser-safe attachment policy. Storage credentials stay in server modules.
export const CHAT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const CHAT_ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.avif,.pdf,.docx,.xlsx,.txt,.csv";
export const CHAT_ATTACHMENT_MIMES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", avif: "image/avif", pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain", csv: "text/csv",
};
export type ChatFileValidationCode = "CHAT_FILE_TOO_LARGE" | "CHAT_FILE_TYPE" | "CHAT_FILE_INVALID";
export const CHAT_MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function validateChatFile(file: File): ChatFileValidationCode | null {
  if (!file.size) return "CHAT_FILE_INVALID";
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) return "CHAT_FILE_TOO_LARGE";
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1].toLowerCase() ?? "";
  if (!Object.hasOwn(CHAT_ATTACHMENT_MIMES, extension)) return "CHAT_FILE_TYPE";
  const mime = file.type.toLowerCase();
  return mime === CHAT_ATTACHMENT_MIMES[extension]
    || (extension === "csv" && ["application/csv", "text/plain"].includes(mime))
    ? null : "CHAT_FILE_TYPE";
}

export function formatChatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function chatMessageRequest(
  payload: { message: string; clientMessageId: string; quickAction?: string; orderReference?: string },
  file: File | null,
): RequestInit {
  if (!file) return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) if (value !== undefined) form.set(key, value);
  form.set("file", file);
  // The browser supplies the multipart boundary.
  return { method: "POST", body: form };
}

export function parseChatAttachmentUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^\/api\/chat\/conversations\/([A-Za-z0-9_-]{1,128})\/attachments\/([0-9a-f-]{36})\/([0-9a-f-]{36})_([0-9a-f]{64})\.(jpg|jpeg|png|webp|gif|avif|pdf|docx|xlsx|txt|csv)$/.exec(value);
  if (!match || !CHAT_MESSAGE_ID_PATTERN.test(match[2]) || !CHAT_MESSAGE_ID_PATTERN.test(match[3])) return null;
  return { conversationId: match[1], messageId: match[2], filename: `${match[3]}_${match[4]}.${match[5]}`, hash: match[4], extension: match[5], isImage: CHAT_ATTACHMENT_MIMES[match[5]].startsWith("image/") };
}
