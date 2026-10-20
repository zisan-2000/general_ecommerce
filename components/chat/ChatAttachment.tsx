"use client";

import { useState } from "react";
import { Download, FileText, ImageIcon, LoaderCircle, RotateCcw } from "lucide-react";
import { parseChatAttachmentUrl } from "@/lib/chat-attachments";

export default function ChatAttachment({ url, conversationId, messageId }: {
  url: string | null | undefined; conversationId: string; messageId: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!url) return null;
  const attachment = parseChatAttachmentUrl(url);
  if (attachment && (attachment.conversationId !== conversationId || attachment.messageId !== messageId)) return null;
  // Existing external attachments remain links only: never embed untrusted URLs.
  const safeLegacy = /^https?:\/\//i.test(url) || /^\/api\/upload\/[A-Za-z0-9_./?=&%-]+$/.test(url);
  if (!attachment && !safeLegacy) return <p className="mt-2 text-xs">Attachment unavailable</p>;
  const image = attachment?.isImage === true;
  return (
    <div className="mt-2 w-64 max-w-full overflow-hidden rounded-xl border bg-background text-foreground shadow-sm">
      {image ? (
        <div className="relative flex min-h-24 items-center justify-center bg-muted/40">
          {!loaded && !failed ? <LoaderCircle aria-label="Loading image" className="absolute h-5 w-5 animate-spin text-muted-foreground" /> : null}
          {!failed ? (
            // Ownership cookies must reach the route, never an image optimizer.
            <img key={attempt} src={`${url}?preview=1`} alt="Shared support chat image" loading="lazy" referrerPolicy="no-referrer"
              width={256} height={192} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
              className={`max-h-52 w-full object-contain ${loaded ? "" : "opacity-0"}`} />
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <p>Image preview unavailable</p>
              <button type="button" className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-primary hover:underline focus-visible:outline-2"
                onClick={() => { setLoaded(false); setFailed(false); setAttempt((value) => value + 1); }}><RotateCcw className="h-3 w-3" aria-hidden="true" />Retry preview</button>
            </div>
          )}
        </div>
      ) : null}
      <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
        download={attachment ? `chat-attachment.${attachment.extension}` : undefined}
        className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {image ? <ImageIcon aria-hidden="true" className="h-4 w-4" /> : <FileText aria-hidden="true" className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{image ? "Image attachment" : attachment ? `${attachment.extension.toUpperCase()} document` : "File attachment"}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{attachment ? "Download securely" : "Open attachment"}</span></span>
        <Download aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </a>
    </div>
  );
}
