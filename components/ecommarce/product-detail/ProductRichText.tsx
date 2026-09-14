"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import DOMPurify from "dompurify";

const subscribeToHydration = () => () => {};

export default function ProductRichText({
  content,
  className = "",
  fallback = null,
}: {
  content: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!content.trim()) return fallback;
  if (!isHydrated) {
    return <div className={`min-h-7 ${className}`} aria-hidden="true" />;
  }

  const hasHtmlMarkup = /<[a-z][\s\S]*>/i.test(content);
  let contentToSanitize = content;

  // Older products can contain plain text. Convert only their line breaks while
  // keeping rich text from the admin editor intact.
  if (!hasHtmlMarkup) {
    const textContainer = document.createElement("div");
    textContainer.textContent = content;
    contentToSanitize = textContainer.innerHTML.replace(/\r?\n/g, "<br>");
  }

  const sanitizedContent = DOMPurify.sanitize(contentToSanitize, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });

  return (
    <div
      className={`product-rich-description ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}
