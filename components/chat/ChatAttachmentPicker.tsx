"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText, ImageIcon, LoaderCircle, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAT_ATTACHMENT_ACCEPT, formatChatFileSize, validateChatFile, type ChatFileValidationCode } from "@/lib/chat-attachments";

export default function ChatAttachmentPicker({ file, disabled, uploading = false, onChange, onError }: {
  file: File | null;
  disabled: boolean;
  uploading?: boolean;
  onChange: (file: File | null) => void;
  onError: (code: ChatFileValidationCode) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file?.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="min-w-0 space-y-2">
      <input ref={input} type="file" className="sr-only" tabIndex={-1} disabled={disabled}
        aria-label="Choose a chat image or file" accept={CHAT_ATTACHMENT_ACCEPT}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (!chosen) return;
          const invalid = validateChatFile(chosen);
          if (invalid) onError(invalid);
          else onChange(chosen);
        }} />
      {file ? (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-primary">
            {preview?.file === file ? (
              // Native img keeps this local object URL out of the image optimizer.
              <img src={preview.url} alt="Selected attachment preview" width={56} height={56} className="h-full w-full object-cover" />
            ) : file.type.startsWith("image/") ? <ImageIcon aria-hidden="true" className="h-6 w-6" /> : <FileText aria-hidden="true" className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground" title={file.name}>{file.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatChatFileSize(file.size)} · {uploading ? "Uploading…" : "Ready to send"}</p>
          </div>
          {uploading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-primary" /> : (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" disabled={disabled}
              aria-label="Remove selected attachment" onClick={() => onChange(null)}><X aria-hidden="true" className="h-4 w-4" /></Button>
          )}
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-lg" disabled={disabled} aria-describedby={helpId}
          onClick={() => input.current?.click()}><Paperclip aria-hidden="true" className="mr-1 h-4 w-4" />{file ? "Change file" : "Attach file"}</Button>
        <p id={helpId} className="min-w-0 pt-0.5 text-[11px] leading-4 text-muted-foreground">Images, PDF, DOCX, XLSX, TXT or CSV<br />One file per message · Up to 4 MB</p>
      </div>
    </div>
  );
}
