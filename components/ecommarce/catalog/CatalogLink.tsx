"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, type ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";

function PendingIndicator() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    const results = document.getElementById("catalog-results");
    results?.setAttribute("aria-busy", "true");
    return () => results?.setAttribute("aria-busy", "false");
  }, [pending]);
  return pending ? <LoaderCircle aria-hidden="true" className="ml-1 inline h-4 w-4 animate-spin" /> : null;
}

export default function CatalogLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false}>{children}<PendingIndicator /></Link>;
}
