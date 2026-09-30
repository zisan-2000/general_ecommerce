"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function CatalogFilterSection({ title, badge, defaultOpen = false, children }: {
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group border-b pb-3 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {badge ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{badge}</span> : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}
